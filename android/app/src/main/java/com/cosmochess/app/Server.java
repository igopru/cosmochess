package com.cosmochess.app;

import android.content.res.AssetManager;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import fi.iki.elonen.NanoHTTPD;

public class Server extends NanoHTTPD {
    private final AssetManager assets;
    private String puzzlesJson;
    private String openingsJson;

    public Server(AssetManager assets, int port) {
        super(port);
        this.assets = assets;
    }

    public void loadData() throws IOException {
        openingsJson = readAsset("openings.json");
        puzzlesJson = readAsset("puzzles.json");
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        if (uri.equals("/api/openings")) return serveOpenings(session);
        if (uri.equals("/api/openings/groups")) return serveOpeningsGroups();
        if (uri.equals("/api/puzzle-meta")) return servePuzzleMeta();
        if (uri.equals("/api/puzzles")) return servePuzzles(session);
        
        String path = uri;
        if (path.contains("?")) path = path.substring(0, path.indexOf("?"));
        if (path.equals("/")) path = "/index.html";
        return serveFile(path);
    }

    private Response serveOpenings(IHTTPSession session) {
        String group = session.getParameters().getOrDefault("group", List.of("")).get(0);
        if (group.isEmpty()) return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", openingsJson);
        return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", filterOpeningsByGroup(group));
    }

    private String filterOpeningsByGroup(String group) {
        StringBuilder out = new StringBuilder("[");
        int depth = 0; boolean inStr = false, inObj = false; int objStart = -1;
        String groupKey = "\"group\":\"" + group + "\"";
        for (int i = 1; i < openingsJson.length(); i++) {
            char c = openingsJson.charAt(i);
            if (c == '"' && (i == 0 || openingsJson.charAt(i - 1) != '\\')) inStr = !inStr;
            if (inStr) continue;
            if (c == '{' && depth == 0) { objStart = i; inObj = true; }
            if (inObj) {
                if (c == '{') depth++;
                if (c == '}') depth--;
                if (depth == 0 && c == '}') {
                    String obj = openingsJson.substring(objStart, i + 1);
                    if (obj.contains(groupKey)) {
                        if (out.length() > 1) out.append(",");
                        out.append(obj);
                    }
                    inObj = false;
                }
            }
        }
        return out.append("]").toString();
    }

    private Response serveOpeningsGroups() {
        StringBuilder out = new StringBuilder("[");
        int depth = 0; boolean inStr = false, inObj = false; int objStart = -1;
        List<String> seen = new ArrayList<>();
        for (int i = 1; i < openingsJson.length(); i++) {
            char c = openingsJson.charAt(i);
            if (c == '"' && (i == 0 || openingsJson.charAt(i - 1) != '\\')) inStr = !inStr;
            if (inStr) continue;
            if (c == '{' && depth == 0) { objStart = i; inObj = true; }
            if (inObj) {
                if (c == '{') depth++;
                if (c == '}') depth--;
                if (depth == 0 && c == '}') {
                    String obj = openingsJson.substring(objStart, i + 1);
                    String grp = extractField(obj, "group");
                    String name = extractField(obj, "openingName");
                    if (grp != null && name != null && !seen.contains(grp)) {
                        seen.add(grp);
                        if (out.length() > 1) out.append(",");
                        out.append("{\"group\":\"").append(grp).append("\",\"name\":\"").append(name).append("\"}");
                    }
                    inObj = false;
                }
            }
        }
        return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", out.append("]").toString());
    }

    private String extractField(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return null;
        start += search.length();
        int end = start;
        while (end < json.length() && json.charAt(end) != '"') end++;
        return end <= start ? null : json.substring(start, end);
    }

    private Response servePuzzleMeta() {
        String json = "{\"themes\":[\"pin\",\"skewer\",\"fork\",\"sacrifice\",\"mate\",\"deflection\",\"attraction\",\"discovered attack\",\"interference\",\"zwischenzug\",\"endgame\",\"opening\",\"middlegame\",\"back rank mate\",\"smothered mate\",\"queen sacrifice\",\"rook endgame\",\"pawn endgame\"],\"ratingRange\":{\"min\":800,\"max\":2500},\"total\":100}";
        return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", json);
    }

    private Response servePuzzles(IHTTPSession session) {
        StringBuilder out = new StringBuilder("[");
        String json = puzzlesJson;
        int depth = 0;
        boolean inStr = false;
        int arrStart = -1;
        boolean first = true;
    
        for (int i = 1; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) inStr = !inStr;
            if (inStr) continue;
        
            if (c == '[' && depth == 0) {
                arrStart = i;
                depth = 1;
            } else if (c == '[') {
                depth++;
            } else if (c == ']') {
                depth--;
                if (depth == 0 && arrStart >= 0) {
                    String arr = json.substring(arrStart + 1, i);
                    String[] parts = parseArray(arr);
                    if (parts.length >= 6) {
                        if (!first) out.append(",");
                        out.append("{\"puzzleId\":\"").append(jsonEscape(parts[0]))
                           .append("\",\"fen\":\"").append(jsonEscape(parts[1]))
                           .append("\",\"moves\":\"").append(jsonEscape(parts[2]))
                           .append("\",\"rating\":").append(parts[3])
                           .append(",\"themes\":\"").append(jsonEscape(parts[4]))
                           .append("\",\"side\":\"").append(jsonEscape(parts[5])).append("\"}");
                        first = false;
                    }
                    arrStart = -1;
                }
            }
        }
        return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", out.append("]").toString());
    }

    private String[] parseArray(String arr) {
        List<String> parts = new ArrayList<>();
        boolean inStr = false;
        int start = 0;
        for (int i = 0; i < arr.length(); i++) {
            char c = arr.charAt(i);
            if (c == '"' && (i == 0 || arr.charAt(i - 1) != '\\')) {
                inStr = !inStr;
                if (!inStr) {
                    String val = arr.substring(start + 1, i).replace("\\\"", "\"").replace("\\\\", "\\");
                    parts.add(val);
                    start = i + 1;
                } else {
                    start = i;
                }
            } else if (!inStr && c == ',') {
                if (start < i) {
                    String val = arr.substring(start, i).trim();
                    if (!val.isEmpty() && !val.equals("null")) parts.add(val);
                }
                start = i + 1;
            }
        }
        return parts.toArray(new String[0]);
    }

    // 🛠️ ВОТ ЭТОГО МЕТОДА НЕ ХВАТАЛО!
    private String jsonEscape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    private Response serveFile(String path) {
        if (path.startsWith("/")) path = path.substring(1);
        String assetPath = "public/" + path;
        try {
            InputStream is = assets.open(assetPath);
            String mime;
            if (path.endsWith(".html")) mime = "text/html; charset=utf-8";
            else if (path.endsWith(".css")) mime = "text/css; charset=utf-8";
            else if (path.endsWith(".js")) mime = "application/javascript; charset=utf-8";
            else if (path.endsWith(".png")) mime = "image/png";
            else if (path.endsWith(".svg")) mime = "image/svg+xml";
            else if (path.endsWith(".json")) mime = "application/json; charset=utf-8";
            else mime = "application/octet-stream";

            Response res = newFixedLengthResponse(Response.Status.OK, mime, is, is.available());
            res.addHeader("Cache-Control", "public, max-age=86400");
            return res;
        } catch (IOException e) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "404: " + path);
        }
    }

    private String readAsset(String name) throws IOException {
        InputStream is = assets.open(name);
        byte[] data = new byte[is.available()];
        is.read(data);
        is.close();
        return new String(data, "UTF-8");
    }
}

package com.cosmochess.app;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Random;

import fi.iki.elonen.NanoHTTPD;

public class Server extends NanoHTTPD {

    private final AssetManager assets;
    private final long startupTime;

    // puzzles: JSON array of [id, fen, moves, rating, themes, side]
    private List<String[]> puzzles = new ArrayList<>();
    private String puzzlesJson;

    // openings: raw JSON string
    private String openingsJson;

    public Server(AssetManager assets, int port) {
        super(port);
        this.assets = assets;
        this.startupTime = System.currentTimeMillis();
    }

    public void loadData() throws IOException {
        openingsJson = readAsset("openings.json");
        puzzlesJson = readAsset("puzzles.json");
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();

        // API endpoints
        if (uri.equals("/api/openings")) {
            return serveOpenings(session);
        }
        if (uri.equals("/api/openings/groups")) {
            return serveOpeningsGroups();
        }
        if (uri.equals("/api/puzzle-meta")) {
            return servePuzzleMeta();
        }
        if (uri.equals("/api/puzzles")) {
            return servePuzzles(session);
        }

        // Strip query string from static file path
        String path = uri;
        if (path.contains("?")) path = path.substring(0, path.indexOf("?"));
        if (path.equals("/")) path = "/index.html";

        // Serve from assets/public/
        return serveFile(path);
    }

    private Response serveOpenings(IHTTPSession session) {
        String group = session.getParameters().getOrDefault("group", List.of("")).get(0);
        if (group.isEmpty()) {
            return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", openingsJson);
        }
        // Parse and filter – simple approach: find group matches
        String filtered = filterOpeningsByGroup(group);
        return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", filtered);
    }

    private String filterOpeningsByGroup(String group) {
        StringBuilder out = new StringBuilder("[");
        // Naive JSON array parsing – skip first char [, walk through items
        String json = openingsJson;
        int depth = 0;
        boolean inStr = false;
        boolean inObj = false;
        int objStart = -1;
        boolean groupMatch = false;
        String groupKey = "\"group\":\"" + group + "\"";

        for (int i = 1; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) inStr = !inStr;
            if (inStr) continue;
            if (c == '{' && depth == 0) { objStart = i; inObj = true; }
            if (inObj) {
                if (c == '{') depth++;
                if (c == '}') depth--;
                if (depth == 0 && c == '}') {
                    // End of object
                    String obj = json.substring(objStart, i + 1);
                    if (obj.contains(groupKey)) {
                        if (out.length() > 1) out.append(",");
                        out.append(obj);
                    }
                    inObj = false;
                }
            }
        }
        out.append("]");
        return out.toString();
    }

    private Response serveOpeningsGroups() {
        StringBuilder out = new StringBuilder("[");
        String json = openingsJson;
        boolean inStr = false;
        int depth = 0;
        boolean inObj = false;
        int objStart = -1;
        // Track seen groups
        List<String> seen = new ArrayList<>();

        for (int i = 1; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) inStr = !inStr;
            if (inStr) continue;
            if (c == '{' && depth == 0) { objStart = i; inObj = true; }
            if (inObj) {
                if (c == '{') depth++;
                if (c == '}') depth--;
                if (depth == 0 && c == '}') {
                    String obj = json.substring(objStart, i + 1);
                    String grp = extractField(obj, "group");
                    String name = extractField(obj, "openingName");
                    if (grp != null && name != null && !seen.contains(grp)) {
                        seen.add(grp);
                        if (out.length() > 1) out.append(",");
                        out.append("{\"group\":\"").append(grp)
                           .append("\",\"name\":\"").append(name)
                           .append("\",\"count\":").append(countByGroup(grp)).append("}");
                    }
                    inObj = false;
                }
            }
        }
        out.append("]");
        return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", out.toString());
    }

    private int countByGroup(String group) {
        int count = 0;
        String json = openingsJson;
        boolean inStr = false;
        int depth = 0;
        boolean inObj = false;
        int objStart = -1;
        String groupKey = "\"group\":\"" + group + "\"";
        for (int i = 1; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) inStr = !inStr;
            if (inStr) continue;
            if (c == '{' && depth == 0) { objStart = i; inObj = true; }
            if (inObj) {
                if (c == '{') depth++;
                if (c == '}') depth--;
                if (depth == 0 && c == '}') {
                    String obj = json.substring(objStart, i + 1);
                    if (obj.contains(groupKey)) count++;
                    inObj = false;
                }
            }
        }
        return count;
    }

    private String extractField(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return null;
        start += search.length();
        int end = start;
        while (end < json.length() && json.charAt(end) != '"') end++;
        if (end <= start) return null;
        return json.substring(start, end);
    }

    private Response servePuzzleMeta() {
        int minR = 99999, maxR = 0;
        for (String[] p : puzzles) {
            int r = Integer.parseInt(p[3]);
            if (r < minR) minR = r;
            if (r > maxR) maxR = r;
        }
        String json = "{\"themes\":[\"pin\",\"skewer\",\"fork\",\"sacrifice\",\"mate\",\"deflection\",\"attraction\",\"discovered attack\",\"interference\",\"zwischenzug\",\"endgame\",\"opening\",\"middlegame\",\"back rank mate\",\"smothered mate\",\"queen sacrifice\",\"rook endgame\",\"pawn endgame\"],\"ratingRange\":{\"min\":" + minR + ",\"max\":" + maxR + "},\"total\":" + puzzles.size() + "}";
        return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", json);
    }

    private Response servePuzzles(IHTTPSession session) {
        String theme = session.getParameters().getOrDefault("theme", List.of("")).get(0).toLowerCase();
        int minRating = parseIntParam(session, "minRating", 0);
        int maxRating = parseIntParam(session, "maxRating", 9999);
        int limit = Math.min(parseIntParam(session, "limit", 100), 100);

        List<String[]> pool = new ArrayList<>();
        for (String[] p : puzzles) {
            int r = Integer.parseInt(p[3]);
            if (r < minRating || r > maxRating) continue;
            if (!theme.isEmpty() && !p[4].toLowerCase().contains(theme)) continue;
            pool.add(p);
        }

        Collections.shuffle(pool, new Random());
        int take = Math.min(limit, pool.size());
        StringBuilder out = new StringBuilder("[");
        for (int i = 0; i < take; i++) {
            String[] p = pool.get(i);
            if (i > 0) out.append(",");
            out.append("{\"puzzleId\":\"").append(jsonEscape(p[0]))
               .append("\",\"fen\":\"").append(jsonEscape(p[1]))
               .append("\",\"moves\":\"").append(jsonEscape(p[2]))
               .append("\",\"rating\":").append(p[3])
               .append(",\"themes\":\"").append(jsonEscape(p[4]))
               .append("\",\"side\":\"").append(p[5]).append("\"}");
        }
        out.append("]");
        return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", out.toString());
    }

    private int parseIntParam(IHTTPSession session, String key, int def) {
        List<String> vals = session.getParameters().get(key);
        if (vals == null || vals.isEmpty()) return def;
        try { return Integer.parseInt(vals.get(0)); } catch (NumberFormatException e) { return def; }
    }

    private String jsonEscape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private Response serveFile(String path) {
        // Normalize path
        if (path.startsWith("/")) path = path.substring(1);
        String assetPath = "public/" + path;
        try {
            InputStream is = assets.open(assetPath);
            byte[] data = readAllBytes(is);
            String mime;
            if (path.endsWith(".html")) mime = "text/html; charset=utf-8";
            else if (path.endsWith(".css")) mime = "text/css; charset=utf-8";
            else if (path.endsWith(".js")) mime = "application/javascript; charset=utf-8";
            else if (path.endsWith(".png")) mime = "image/png";
            else if (path.endsWith(".svg")) mime = "image/svg+xml";
            else if (path.endsWith(".json")) mime = "application/json; charset=utf-8";
            else mime = "application/octet-stream";
            Response res = newFixedLengthResponse(Response.Status.OK, mime, data);
            res.addHeader("Cache-Control", "public, max-age=86400");
            return res;
        } catch (IOException e) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "404");
        }
    }

    private byte[] readAllBytes(InputStream is) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] tmp = new byte[8192];
        int n;
        while ((n = is.read(tmp)) != -1) buf.write(tmp, 0, n);
        return buf.toByteArray();
    }

    private String readAsset(String name) throws IOException {
        InputStream is = assets.open(name);
        byte[] data = readAllBytes(is);
        is.close();
        return new String(data, "UTF-8");
    }
}

package com.mehedi.gptharness;

import java.net.URI;

/** A hostname suffix or URL substring is never sufficient to trust a page. */
final class OriginPolicy {
    private final URI origin;

    OriginPolicy(String origin) { this.origin = URI.create(origin); }

    boolean isTrusted(String value) {
        if (value == null) return false;
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && origin.getHost().equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getRawUserInfo() == null;
        } catch (IllegalArgumentException error) { return false; }
    }

    boolean isPrivateFile(String value) {
        return isTrusted(value) && URI.create(value).getPath().startsWith("/api/files/");
    }

    boolean isExternalLink(String value) {
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            return ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme))
                && uri.getRawUserInfo() == null;
        } catch (IllegalArgumentException error) { return false; }
    }
}

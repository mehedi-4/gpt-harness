package com.mehedi.gptharness;

import static org.junit.Assert.*;
import org.junit.Test;

public class OriginPolicyTest {
    private final OriginPolicy policy = new OriginPolicy("https://gpt-harness.pages.dev");

    @Test public void acceptsOnlyTheExactSecureOrigin() {
        assertTrue(policy.isTrusted("https://gpt-harness.pages.dev/"));
        assertTrue(policy.isTrusted("https://gpt-harness.pages.dev:443/api/auth/session"));
        for (String url : new String[] {
            "http://gpt-harness.pages.dev", "https://gpt-harness.pages.dev.evil.example/",
            "https://gpt-harness.pages.dev@evil.example", "https://evil.example@gpt-harness.pages.dev/",
            "https://gpt-harness.pages.dev:444/", "javascript:alert(1)", "file:///data/data/app", "intent://example", "not a url"
        }) assertFalse(url, policy.isTrusted(url));
    }

    @Test public void keepsAuthenticatedDownloadsOnTheSameServer() {
        assertTrue(policy.isPrivateFile("https://gpt-harness.pages.dev/api/files/user/image?download=1"));
        assertFalse(policy.isPrivateFile("https://gpt-harness.pages.dev/api/auth/session"));
        assertFalse(policy.isPrivateFile("https://evil.example/api/files/user/image"));
        assertFalse(policy.isExternalLink("intent://example#Intent;end"));
        assertFalse(policy.isExternalLink("data:text/html,test"));
        assertTrue(policy.isExternalLink("https://example.com/reference"));
    }
}

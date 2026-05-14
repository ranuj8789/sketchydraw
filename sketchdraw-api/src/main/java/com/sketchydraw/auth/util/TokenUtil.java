package com.sketchydraw.auth.util;

import java.util.UUID;

public final class TokenUtil {

    private TokenUtil() {
    }

    public static String randomToken() {
        return UUID.randomUUID().toString().replace("-", "") +
                UUID.randomUUID().toString().replace("-", "");
    }
}
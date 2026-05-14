package com.sketchydraw.common.filter;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

@Component
public class CorrelationIdFilter implements Filter {

    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        // 1. Get from header OR generate
        String correlationId = req.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null || correlationId.isEmpty()) {
            correlationId = UUID.randomUUID().toString();
        }

        try {
            // 2. Put in MDC (for logging)
            MDC.put("correlationId", correlationId);

            // 3. Add in response header
            res.setHeader(CORRELATION_ID_HEADER, correlationId);

            // 4. Continue request
            chain.doFilter(request, response);

        } finally {
            // IMPORTANT: clean up
            MDC.remove("correlationId");
        }
    }
}
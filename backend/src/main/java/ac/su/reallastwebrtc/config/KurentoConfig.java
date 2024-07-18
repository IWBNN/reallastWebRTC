package ac.su.reallastwebrtc.config;

import org.kurento.client.KurentoClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KurentoConfig {

    @Value("${kms.websocket.uri}")
    private String kmsWebSocketUri;

    @Bean
    public KurentoClient kurentoClient() {
        return KurentoClient.create(kmsWebSocketUri);
    }
}

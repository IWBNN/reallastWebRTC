package ac.su.reallastwebrtc.handler;

import org.kurento.client.*;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RoomHandler extends TextWebSocketHandler {

    @Autowired
    private KurentoClient kurentoClient;

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, MediaPipeline> pipelines = new ConcurrentHashMap<>();
    private final Map<String, WebRtcEndpoint> webRtcEndpoints = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = objectMapper.readValue(message.getPayload(), Map.class);
        String id = (String) payload.get("id");

        switch (id) {
            case "joinRoom":
                joinRoom(session, payload);
                break;
            case "receiveVideoFrom":
                receiveVideoFrom(session, payload);
                break;
            case "onIceCandidate":
                onIceCandidate(session, payload);
                break;
            default:
                break;
        }
    }

    private void joinRoom(WebSocketSession session, Map<String, Object> payload) throws Exception {
        String room = (String) payload.get("room");
        MediaPipeline pipeline = kurentoClient.createMediaPipeline();
        pipelines.put(session.getId(), pipeline);

        WebRtcEndpoint webRtcEndpoint = new WebRtcEndpoint.Builder(pipeline).build();
        webRtcEndpoints.put(session.getId(), webRtcEndpoint);

        webRtcEndpoint.addIceCandidateFoundListener(event -> {
            Map<String, Object> response = Map.of(
                    "id", "iceCandidate",
                    "candidate", event.getCandidate(),
                    "sender", session.getId()
            );
            try {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        webRtcEndpoint.connect(webRtcEndpoint);

        Map<String, Object> response = Map.of(
                "id", "existingParticipants",
                "data", sessions.keySet()
        );
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
    }

    private void receiveVideoFrom(WebSocketSession session, Map<String, Object> payload) throws Exception {
        String sender = (String) payload.get("sender");
        String sdpOffer = (String) payload.get("sdpOffer");

        WebRtcEndpoint senderEndpoint = webRtcEndpoints.get(sender);
        WebRtcEndpoint receiverEndpoint = webRtcEndpoints.get(session.getId());

        senderEndpoint.connect(receiverEndpoint);

        String sdpAnswer = receiverEndpoint.processOffer(sdpOffer);
        receiverEndpoint.gatherCandidates();

        Map<String, Object> response = Map.of(
                "id", "receiveVideoAnswer",
                "sdpAnswer", sdpAnswer,
                "sender", sender
        );
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
    }

    private void onIceCandidate(WebSocketSession session, Map<String, Object> payload) {
        String sender = (String) payload.get("sender");
        Map<String, Object> candidateMap = (Map<String, Object>) payload.get("candidate");

        IceCandidate candidate = new IceCandidate(
                (String) candidateMap.get("candidate"),
                (String) candidateMap.get("sdpMid"),
                ((Number) candidateMap.get("sdpMLineIndex")).intValue()
        );

        webRtcEndpoints.get(sender).addIceCandidate(candidate);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        MediaPipeline pipeline = pipelines.remove(session.getId());
        if (pipeline != null) {
            pipeline.release();
        }
        webRtcEndpoints.remove(session.getId());
        sessions.remove(session.getId());
    }
}

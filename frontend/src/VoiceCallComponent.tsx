import React, { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import kurentoUtils from 'kurento-utils';

interface Participant {
    webRtcPeer: any;
}

const VoiceChat: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [participants, setParticipants] = useState<{ [key: string]: Participant }>({});
    const localAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        // WebSocket URL을 직접 하드코딩
        const websocketUrl = 'wss://iwbnn.shop/ws';
        const newSocket = io(websocketUrl);
        setSocket(newSocket);

        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            setLocalStream(stream);
            if (localAudioRef.current) {
                localAudioRef.current.srcObject = stream;
            }
        });

        newSocket.on('message', handleSignalingMessage);

        return () => {
            newSocket.close();
        };
    }, []);

    const handleSignalingMessage = (message: any) => {
        switch (message.id) {
            case 'existingParticipants':
                onExistingParticipants(message);
                break;
            case 'newParticipantArrived':
                onNewParticipant(message);
                break;
            case 'participantLeft':
                onParticipantLeft(message);
                break;
            case 'receiveVideoAnswer':
                receiveVideoResponse(message);
                break;
            case 'iceCandidate':
                addIceCandidate(message);
                break;
            default:
                break;
        }
    };

    const joinRoom = () => {
        if (socket) {
            const message = {
                id: 'joinRoom',
                room: 'testRoom'
            };
            socket.emit('message', message);
        }
    };

    const onExistingParticipants = (message: any) => {
        const constraints = {
            audio: true
        };
        const participant = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(constraints, (error: any) => {
            if (error) {
                return console.error(error);
            }
            participant.generateOffer((error: any, offerSdp: any) => {
                if (error) {
                    return console.error(error);
                }
                const message = {
                    id: 'receiveVideoFrom',
                    sender: 'me',
                    sdpOffer: offerSdp
                };
                if (socket) {
                    socket.emit('message', message);
                }
            });
        });
        setParticipants((prev) => ({ ...prev, 'me': { webRtcPeer: participant } }));

        message.data.forEach((participantId: string) => {
            receiveVideoFrom(participantId);
        });
    };

    const onNewParticipant = (message: any) => {
        receiveVideoFrom(message.newParticipantId);
    };

    const receiveVideoFrom = (participantId: string) => {
        const constraints = {
            audio: true
        };
        const participant = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(constraints, (error: any) => {
            if (error) {
                return console.error(error);
            }
            participant.generateOffer((error: any, offerSdp: any) => {
                if (error) {
                    return console.error(error);
                }
                const message = {
                    id: 'receiveVideoFrom',
                    sender: participantId,
                    sdpOffer: offerSdp
                };
                if (socket) {
                    socket.emit('message', message);
                }
            });
        });
        setParticipants((prev) => ({ ...prev, [participantId]: { webRtcPeer: participant } }));
    };

    const receiveVideoResponse = (message: any) => {
        const participant = participants[message.sender];
        participant.webRtcPeer.processAnswer(message.sdpAnswer);
    };

    const addIceCandidate = (message: any) => {
        const participant = participants[message.sender];
        participant.webRtcPeer.addIceCandidate(message.candidate);
    };

    const onParticipantLeft = (message: any) => {
        const participant = participants[message.name];
        if (participant) {
            participant.webRtcPeer.dispose();
            setParticipants((prev) => {
                const newParticipants = { ...prev };
                delete newParticipants[message.name];
                return newParticipants;
            });
        }
    };

    return (
        <div>
            <audio ref={localAudioRef} autoPlay muted />
            <button onClick={joinRoom}>Join Room</button>
            {Object.keys(participants).map((key) => (
                <audio key={key} ref={(audio) => { if (audio) participants[key].webRtcPeer.getRemoteStream() }} autoPlay />
            ))}
        </div>
    );
};

export default VoiceChat;

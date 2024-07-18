import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const VoiceChat = () => {
    const [socket, setSocket] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [participants, setParticipants] = useState({});
    const localAudioRef = useRef(null);

    useEffect(() => {
        // WebSocket URL을 직접 하드코딩
        const websocketUrl = 'wss://iwbnn.shop/ws';
        const newSocket = io(websocketUrl);
        setSocket(newSocket);

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            setLocalStream(stream);
            localAudioRef.current.srcObject = stream;
        });

        newSocket.on('message', handleSignalingMessage);

        return () => {
            newSocket.close();
        };
    }, []);

    const handleSignalingMessage = (message) => {
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
        const message = {
            id: 'joinRoom',
            room: 'testRoom'
        };
        socket.emit('message', message);
    };

    const onExistingParticipants = (message) => {
        const constraints = {
            audio: true
        };
        const participant = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(constraints, function (error) {
            if (error) {
                return console.error(error);
            }
            this.generateOffer((error, offerSdp) => {
                if (error) {
                    return console.error(error);
                }
                const message = {
                    id: 'receiveVideoFrom',
                    sender: 'me',
                    sdpOffer: offerSdp
                };
                socket.emit('message', message);
            });
        });
        setParticipants((prev) => ({ ...prev, 'me': participant }));

        message.data.forEach((participantId) => {
            receiveVideoFrom(participantId);
        });
    };

    const onNewParticipant = (message) => {
        receiveVideoFrom(message.newParticipantId);
    };

    const receiveVideoFrom = (participantId) => {
        const constraints = {
            audio: true
        };
        const participant = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(constraints, function (error) {
            if (error) {
                return console.error(error);
            }
            this.generateOffer((error, offerSdp) => {
                if (error) {
                    return console.error(error);
                }
                const message = {
                    id: 'receiveVideoFrom',
                    sender: participantId,
                    sdpOffer: offerSdp
                };
                socket.emit('message', message);
            });
        });
        setParticipants((prev) => ({ ...prev, [participantId]: participant }));
    };

    const receiveVideoResponse = (message) => {
        const participant = participants[message.sender];
        participant.processAnswer(message.sdpAnswer);
    };

    const addIceCandidate = (message) => {
        const participant = participants[message.sender];
        participant.addIceCandidate(message.candidate);
    };

    const onParticipantLeft = (message) => {
        const participant = participants[message.name];
        if (participant) {
            participant.dispose();
            delete participants[message.name];
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
                <audio key={key} ref={(audio) => { if (audio) participants[key].stream = audio.srcObject }} autoPlay />
            ))}
        </div>
    );
};

export default VoiceChat;

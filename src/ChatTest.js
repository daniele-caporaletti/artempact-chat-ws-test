import { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

let stompClient = null;
const WS_ENDPOINT = process.env.REACT_APP_WS_ENDPOINT || '/chat/v0/ws';

export default function ChatTest() {
  const [connected, setConnected] = useState(false);
  const [senderId, setSenderId] = useState('user1');
  const [receiverId, setReceiverId] = useState('user2');
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const clientRef = useRef(null);

  const connect = () => {
    const socket = new SockJS(WS_ENDPOINT);
    const client = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        console.log('🟢 Connesso al WebSocket');
        setConnected(true);

        client.subscribe('/topic/messages', (message) => {
          const msg = JSON.parse(message.body);
          console.log('📥 Messaggio ricevuto su /topic/messages:', msg);
          setMessages(prev => [...prev, msg]);
        });
      },
    });
    client.activate();
    stompClient = client;
    clientRef.current = client;
  };

  const subscribeToConversation = () => {
    if (clientRef.current && connected) {
      const topic = `/topic/conversation.${senderId}.${receiverId}`;
      clientRef.current.subscribe(topic, (response) => {
        const res = JSON.parse(response.body);
        console.log('📘 Conversazione ricevuta:', res);
        setConversation(res);
      });
      requestConversation();
    }
  };

  const sendMessage = () => {
    if (stompClient && connected && content.trim()) {
      const msg = {
        senderId,
        receiverId,
        content
      };
      console.log('📤 Invio messaggio:', msg);
      stompClient.publish({
        destination: "/app/chat.sendMessage",
        body: JSON.stringify(msg),
      });
      setContent('');
    }
  };

  const markAsReceived = (messageId) => {
    if (stompClient && connected) {
      console.log('✅ Messaggio marcato come ricevuto:', messageId);
      stompClient.publish({
        destination: "/app/chat.markAsReceived",
        body: messageId,
      });
    }
  };

  const requestConversation = () => {
    if (stompClient && connected) {
      const req = {
        userA: senderId,
        userB: receiverId,
        page: 0,
        size: 20
      };
      console.log('🔍 Richiesta conversazione:', req);
      stompClient.publish({
        destination: "/app/chat.getConversation",
        body: JSON.stringify(req),
      });
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (stompClient && stompClient.deactivate) stompClient.deactivate();
    };
  }, []);

  useEffect(() => {
    if (connected) {
      subscribeToConversation();
    }
  }, [senderId, receiverId, connected]);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ background: '#f5f5f5', padding: '10px', marginBottom: '15px', border: '1px solid #ccc' }}>
        <strong>🔌 WebSocket Endpoint:</strong> {WS_ENDPOINT}
      </div>

      <h1>Chat WebSocket Test</h1>

      <div style={{ marginBottom: '10px' }}>
        <label>
          Sender ID:
          <input
            type="text"
            value={senderId}
            onChange={e => setSenderId(e.target.value)}
          />
        </label>
        <label style={{ marginLeft: '10px' }}>
          Receiver ID:
          <input
            type="text"
            value={receiverId}
            onChange={e => setReceiverId(e.target.value)}
          />
        </label>
        <button onClick={requestConversation} style={{ marginLeft: '10px' }}>
          Carica conversazione
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="Scrivi un messaggio..."
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} style={{ marginLeft: '10px' }}>
          Invia
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <h3>📋 Conversazione paginata (ultimi 20 messaggi):</h3>
        {conversation?.content?.length > 0 ? (
          conversation.content.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: '5px' }}>
              <strong>{msg.senderId}:</strong> {msg.content} {' '}
              <span style={{ fontSize: '0.85em', color: '#555' }}>({msg.status})</span>
              {msg.status !== 'RECEIVED' && msg.receiverId === senderId && (
                <button onClick={() => markAsReceived(msg.id)} style={{ marginLeft: '10px' }}>
                  Mark as Received
                </button>
              )}
            </div>
          ))
        ) : (
          <p>Nessun messaggio</p>
        )}
      </div>

      <div style={{ border: '1px solid #ccc', padding: '10px', height: '300px', overflowY: 'scroll' }}>
        <h3>📨 Messaggi ricevuti live:</h3>
        {messages.length > 0 ? (
          messages.map((msg, idx) => (
            <div key={idx}>
              <strong>{msg.senderId}:</strong> {msg.content} {' '}
              <span style={{ fontSize: '0.85em', color: '#555' }}>({msg.status})</span>
            </div>
          ))
        ) : (
          <p>Nessun messaggio ricevuto</p>
        )}
      </div>
    </div>
  );
}
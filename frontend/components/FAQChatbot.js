import { useState, useEffect, useRef } from "react";

const FAQS = [
  {
    q: "How often can I donate?",
    a: "To ensure donor safety, you are eligible to donate whole blood once every 90 days. The system automatically tracks this and calculates your remaining cooldown days on your dashboard statistics.",
    keywords: ["often", "cooldown", "days", "time", "frequently", "schedule", "next"]
  },
  {
    q: "What should I do before donating?",
    a: "Stay hydrated by drinking plenty of water, consume a healthy, low-fat meal prior to your appointment, and bring a government-issued photo ID. Avoid alcohol and heavy exercise 24 hours before donating.",
    keywords: ["eat", "drink", "food", "prep", "meal", "alcohol", "exercise", "before", "precaution"]
  },
  {
    q: "Who can see my location details?",
    a: "Your city and coordinates (lat/lng) are used solely to match you with compatible emergency blood requests nearby. Your precise location is never exposed publicly to unverified users.",
    keywords: ["location", "coordinates", "privacy", "map", "gps", "track", "security"]
  },
  {
    q: "How do I message hospitals?",
    a: "Once you accept or view a broadcast request from a hospital, you can use the built-in real-time Live Chat tab on your dashboard to message their coordinators directly.",
    keywords: ["contact", "chat", "message", "hospital", "communicate", "talk"]
  },
  {
    q: "What if I don't want to donate after accepting a request?",
    a: "If you change your mind after accepting, you can decline the request in the dashboard; the system will notify the hospital and set your status back to available.",
    keywords: ["donate", "accept", "change mind", "decline", "cancel", "request"]
  },
];

export default function FAQChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello! I am HemoLink Support Bot. How can I help you today?" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = (text) => {
    if (!text.trim()) return;

    // Add user message
    const newMessages = [...messages, { sender: "user", text }];
    setMessages(newMessages);
    setInputValue("");

    // Calculate response
    setTimeout(() => {
      const query = text.toLowerCase();
      let matchedAns = "";

      for (const faq of FAQS) {
        if (faq.keywords.some(keyword => query.includes(keyword))) {
          matchedAns = faq.a;
          break;
        }
      }

      if (matchedAns) {
        setMessages(prev => [...prev, { sender: "bot", text: matchedAns }]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: "bot",
            text: "I'm not sure I understand. Try asking about 'donation cooldown', 'preparations before donating', 'location privacy', or 'contacting hospitals'. You can also click the quick help chips above!"
          }
        ]);
      }
    }, 600);
  };

  const handleChipClick = (faq) => {
    const newMessages = [...messages, { sender: "user", text: faq.q }];
    setMessages(newMessages);

    setTimeout(() => {
      setMessages(prev => [...prev, { sender: "bot", text: faq.a }]);
    }, 500);
  };

  return (
    <div style={{ position: "fixed", bottom: "30px", right: "30px", zIndex: 9999, fontFamily: "'Inter', sans-serif" }}>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            backgroundColor: "#e63946",
            border: "none",
            color: "#ffffff",
            fontSize: "26px",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(230, 57, 70, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
            animation: "pulse 2s infinite"
          }}
          className="chatbot-toggle"
        >
          🤖
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          width: "360px",
          height: "480px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 12px 36px rgba(15, 23, 42, 0.15)",
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: "#e63946",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#ffffff"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>🤖</span>
              <div>
                <div style={{ fontWeight: "700", fontSize: "14px" }}>HemoLink Assistant</div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", opacity: 0.9 }}>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "12px"
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            padding: "20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            backgroundColor: "#f8fafc"
          }}>
            {messages.map((msg, idx) => {
              const isBot = msg.sender === "bot";
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isBot ? "flex-start" : "flex-end",
                    maxWidth: "80%",
                    backgroundColor: isBot ? "#ffffff" : "#e63946",
                    color: isBot ? "#1e293b" : "#ffffff",
                    padding: "12px 16px",
                    borderRadius: isBot ? "16px 16px 16px 4px" : "16px 16px 4px 16px",
                    boxShadow: isBot ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
                    border: isBot ? "1px solid #e2e8f0" : "none",
                    fontSize: "13px",
                    lineHeight: "1.5"
                  }}
                >
                  {msg.text}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Help Chips */}
          <div style={{
            padding: "10px 14px",
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            whiteSpace: "nowrap"
          }}>
            {FAQS.map((faq, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(faq)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "14px",
                  backgroundColor: "#fee2e2",
                  color: "#e63946",
                  border: "1px solid #fca5a5",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.2s"
                }}
              >
                {faq.q}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            style={{
              padding: "12px 14px",
              backgroundColor: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: "8px"
            }}
          >
            <input
              type="text"
              placeholder="Ask a question..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1.5px solid #cbd5e1",
                fontSize: "13px",
                outline: "none",
                transition: "border-color 0.2s"
              }}
            />
            <button
              type="submit"
              style={{
                padding: "10px 16px",
                backgroundColor: "#e63946",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 8px 24px rgba(230, 57, 70, 0.35); }
          50% { transform: scale(1.05); box-shadow: 0 8px 30px rgba(230, 57, 70, 0.5); }
          100% { transform: scale(1); box-shadow: 0 8px 24px rgba(230, 57, 70, 0.35); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

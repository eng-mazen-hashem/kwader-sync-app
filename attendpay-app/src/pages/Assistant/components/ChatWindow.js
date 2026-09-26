import React, { useRef, useEffect } from 'react';
import MessageItem from './MessageItem';
import { HiOutlinePaperAirplane } from 'react-icons/hi';

const ChatWindow = ({ messages, loading, input, setInput, sendMessage, onAction }) => {
    const chatEndRef = useRef(null);
    const textareaRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (loading || !input.trim()) return;
        sendMessage();
        if (textareaRef.current) {
            textareaRef.current.style.height = '42px';
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e) => {
        const target = e.target;
        target.style.height = '42px';
        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
        setInput(target.value);
    };

    const hasHistorical = messages.some(m => m.isHistorical && m.id !== 'welcome_1');

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Messages Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 20px',
                scrollbarWidth: 'thin',
                display: 'flex',
                flexDirection: 'column',
                gap: 5
            }}>
                {hasHistorical && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        gap: 8
                    }}>
                        <span style={{
                            fontSize: '0.74rem',
                            color: '#a5b4fc',
                            background: 'rgba(99, 102, 241, 0.1)',
                            padding: '5px 14px',
                            borderRadius: 20,
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}>
                            <span>📌</span>
                            <span>الرسائل السابقة محفوظة للمراجعة (لا تستهلك من رصيد الذكاء الاصطناعي)</span>
                        </span>
                    </div>
                )}
                {messages.map((msg, index) => {
                    const isFirstCurrentSession = !msg.isHistorical && (index > 0 && messages[index - 1]?.isHistorical);
                    return (
                        <React.Fragment key={msg.id || index}>
                            {isFirstCurrentSession && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '16px 0',
                                    gap: 12
                                }}>
                                    <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
                                    <span style={{
                                        fontSize: '0.72rem',
                                        color: 'var(--text-muted)',
                                        background: 'rgba(255, 255, 255, 0.04)',
                                        padding: '3px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255, 255, 255, 0.08)'
                                    }}>
                                        ── الجلسة الحالية ──
                                    </span>
                                    <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
                                </div>
                            )}
                            <MessageItem msg={msg} onAction={onAction} />
                        </React.Fragment>
                    );
                })}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div style={{
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.02)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-end',
                gap: 12
            }}>
                <div style={{
                    flex: 1,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 14,
                    border: '1.5px solid var(--border-color)',
                    padding: '4px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="اسأل وتين عن أي شيء (رواتب، حضور، موظفين...)"
                        style={{
                            width: '100%',
                            height: 42,
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            fontSize: '0.9rem',
                            fontFamily: 'Cairo',
                            outline: 'none',
                            resize: 'none',
                            padding: '10px 0',
                            lineHeight: 1.4,
                            direction: 'rtl'
                        }}
                    />
                </div>
                
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        border: 'none',
                        background: input.trim() && !loading
                            ? 'linear-gradient(135deg, #6c63ff, #a78bfa)'
                            : 'var(--bg-tertiary)',
                        color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
                        cursor: input.trim() && !loading ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        fontSize: '1.2rem',
                        boxShadow: input.trim() && !loading ? '0 4px 15px rgba(108,99,255,0.3)' : 'none'
                    }}
                >
                    {loading ? (
                        <div style={{
                            width: 20,
                            height: 20,
                            border: '2px solid rgba(255,255,255,0.2)',
                            borderTopColor: '#fff',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                    ) : (
                        <HiOutlinePaperAirplane style={{ transform: 'rotate(-45deg)', marginLeft: 4 }} />
                    )}
                </button>
            </div>
        </div>
    );
};

export default ChatWindow;

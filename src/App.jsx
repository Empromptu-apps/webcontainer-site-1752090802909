import React, { useState, useEffect, useRef } from 'react';

const URLChatbot = () => {
  const [url, setUrl] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [agentId, setAgentId] = useState(null);
  const [isChatReady, setIsChatReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [apiCalls, setApiCalls] = useState([]);
  const [createdObjects, setCreatedObjects] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const logApiCall = (endpoint, data, response) => {
    const call = {
      timestamp: new Date().toISOString(),
      endpoint,
      request: data,
      response
    };
    setApiCalls(prev => [...prev, call]);
  };

  const apiCall = async (endpoint, data, method = 'POST') => {
    const response = await fetch(`https://builder.empromptu.ai/api_tools${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 4e31d5e989125dc49a09d234c59e85bc',
        'X-Generated-App-ID': '485bdeaf-d1df-45aa-b9ee-8c062d76c47b'
      },
      body: method !== 'GET' ? JSON.stringify(data) : undefined
    });
    const result = await response.json();
    logApiCall(endpoint, data, result);
    return result;
  };

  const processUrl = async () => {
    if (!url.trim()) return;
    
    setIsProcessingUrl(true);
    setIsChatReady(false);
    setMessages([]);
    setCreatedObjects([]);
    
    try {
      // Step 1: Ingest URL content
      await apiCall('/input_data', {
        created_object_name: 'url_content',
        data_type: 'urls',
        input_data: [url]
      });
      setCreatedObjects(prev => [...prev, 'url_content']);

      // Step 2: Summarize the content
      await apiCall('/apply_prompt', {
        created_object_names: ['url_summary'],
        prompt_string: 'Please provide a comprehensive summary of this content: {url_content}',
        inputs: [{
          input_object_name: 'url_content',
          mode: 'combine_events'
        }]
      });
      setCreatedObjects(prev => [...prev, 'url_summary']);

      // Step 3: Get the summary
      const summaryResponse = await apiCall('/return_data/url_summary', {}, 'GET');
      const summary = summaryResponse.text_value;

      // Step 4: Create a new agent with the summary
      const agentResponse = await apiCall('/create-agent', {
        instructions: `You are a helpful assistant that can discuss and answer questions about the following content that was just summarized from a website: ${summary}. Be conversational and helpful, and reference the content when relevant to user questions.`,
        agent_name: 'Website Content Assistant'
      });

      setAgentId(agentResponse.agent_id);

      // Step 5: Get initial greeting from agent
      const greetingResponse = await apiCall('/chat', {
        agent_id: agentResponse.agent_id,
        message: 'Please greet the user and briefly mention what you learned from the website content they provided.'
      });

      setMessages([{
        type: 'bot',
        content: greetingResponse.response,
        timestamp: new Date()
      }]);

      setIsChatReady(true);
      
    } catch (error) {
      console.error('Error processing URL:', error);
      setMessages([{
        type: 'bot',
        content: 'Sorry, I encountered an error processing that URL. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessingUrl(false);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || !agentId || !isChatReady) return;

    const userMessage = {
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = currentMessage;
    setCurrentMessage('');

    try {
      const response = await apiCall('/chat', {
        agent_id: agentId,
        message: messageToSend
      });

      const botMessage = {
        type: 'bot',
        content: response.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const deleteObjects = async () => {
    for (const objectName of createdObjects) {
      try {
        await apiCall(`/objects/${objectName}`, {}, 'DELETE');
      } catch (error) {
        console.error(`Error deleting ${objectName}:`, error);
      }
    }
    setCreatedObjects([]);
    setMessages([]);
    setIsChatReady(false);
    setAgentId(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            URL Content Chatbot
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-4 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              {showDebug ? 'Hide' : 'Show'} Debug
            </button>
            {createdObjects.length > 0 && (
              <button
                onClick={deleteObjects}
                className="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete Objects
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Column */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Upload URL
              </h2>
              
              <div className="border-2 border-dashed border-primary-300 dark:border-primary-600 rounded-xl p-6 text-center">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-primary-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter URL to analyze:
                </label>
                
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isProcessingUrl}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  aria-describedby="url-help"
                />
                
                <p id="url-help" className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Paste any website URL to analyze its content
                </p>
                
                <button
                  onClick={processUrl}
                  disabled={isProcessingUrl || !url.trim()}
                  className="mt-4 w-full px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  aria-label="Analyze URL content"
                >
                  {isProcessingUrl ? (
                    <div className="flex items-center justify-center">
                      <div className="spinner mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    'Analyze URL'
                  )}
                </button>
                
                {isProcessingUrl && (
                  <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex items-center">
                      <div className="spinner mr-3"></div>
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Processing URL content...
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          This may take 10-30 seconds
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Column */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-sm font-bold">AI</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Content Assistant
                  </h3>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isChatReady 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {isChatReady ? 'Ready' : 'Waiting for URL'}
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4" aria-live="polite" aria-label="Chat messages">
                {messages.length === 0 && !isProcessingUrl && (
                  <div className="flex items-center justify-center h-full text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      <svg className="mx-auto h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-lg font-medium mb-2">Ready to chat!</p>
                      <p className="text-sm">Enter a URL above to start discussing its content</p>
                    </div>
                  </div>
                )}
                
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`mb-4 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl message-bubble ${
                        message.type === 'user'
                          ? 'bg-primary-600 text-white rounded-br-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isChatReady ? "Ask me anything..." : "Process a URL first to start chatting"}
                    disabled={!isChatReady}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    aria-label="Type your message"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!currentMessage.trim() || !isChatReady}
                    className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    aria-label="Send message"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              API Debug Information
            </h3>
            
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Created Objects: {createdObjects.join(', ') || 'None'}
              </h4>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {apiCalls.map((call, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {call.endpoint}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400">
                      Request/Response
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Request:</p>
                        <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                          {JSON.stringify(call.request, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Response:</p>
                        <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                          {JSON.stringify(call.response, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default URLChatbot;

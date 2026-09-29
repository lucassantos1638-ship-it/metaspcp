import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
  dangerouslyAllowBrowser: true, // Necessário pois estamos chamando a partir do frontend
});

type Message = {
  role: "user" | "assistant";
  content: string;
};

export const ChatAssistente = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Como posso ajudar você hoje?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rolar para baixo automaticamente quando novas mensagens chegarem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Histórico completo para enviar à API
      const conversationHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // ou gpt-4o se tiver acesso
        messages: [
          {
            role: "system",
            content: "Você é um assistente útil e simpático de um sistema de Planejamento e Controle de Produção (PCP) chamado Meta PCP. Você deve ajudar o usuário de forma sucinta e direta.",
          },
          ...conversationHistory,
        ],
      });

      const assistantReply = response.choices[0]?.message?.content;
      if (assistantReply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantReply },
        ]);
      }
    } catch (error) {
      console.error("Erro na OpenAI:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua solicitação. Verifique se a chave de API é válida.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg print:hidden z-50 flex items-center justify-center transition-transform hover:scale-110"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Janela de Chat */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[500px] shadow-2xl flex flex-col z-50 print:hidden animate-in slide-in-from-bottom-5">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-primary/5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Assistente Virtual
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 p-4 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 pr-4">
              <div className="flex flex-col gap-4 pb-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex gap-2 max-w-[85%] ${
                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {msg.role === "user" ? (
                          <div className="bg-primary/20 p-1.5 rounded-full">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                        ) : (
                          <div className="bg-muted p-1.5 rounded-full">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-2 max-w-[85%]">
                      <div className="flex-shrink-0 mt-1">
                        <div className="bg-muted p-1.5 rounded-full">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Digitando...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-4 border-t gap-2 bg-background">
            <Input
              placeholder="Digite sua mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              disabled={isLoading}
            />
            <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}
    </>
  );
};

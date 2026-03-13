import React, { useEffect } from "react";
import toast from "react-hot-toast";

export default function Toast({ message }) {
  useEffect(() => {
    if (message) {
      // Basic heuristic for error vs success based on the app's messages
      const isError = message.startsWith("❌ ") || 
                      message.toLowerCase().includes("failed") || 
                      message.toLowerCase().includes("error") || 
                      message.toLowerCase().includes("invalid") ||
                      message.toLowerCase().includes("wrong");
                      
      if (isError) {
        toast.error(message.replace("❌ ", ""), { id: message });
      } else {
        toast.success(message, { id: message });
      }
    }
  }, [message]);

  return null;
}

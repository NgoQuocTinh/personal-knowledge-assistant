# src/chat/prompts.py
"""
Prompt templates for chat

Learn: Centralized prompt management
"""

from typing import Dict
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from config.setting import get_settings

def get_rag_prompt() -> ChatPromptTemplate:
    """
    Get RAG prompt template (without conversation history)
    
    Returns:
        ChatPromptTemplate
    """
    settings = get_settings()
    config = settings.prompt
    
    # Build rules string
    rules_text = "\n".join([f"{i+1}. {rule}" for i, rule in enumerate(config.rules)])
    
    template = f"""{config.system_message}

    RULES:
    {rules_text}

    DOCUMENT CONTEXT:
    {{context}}

    QUESTION: {{question}}

    ANSWER:"""
    
    return ChatPromptTemplate.from_template(template)

def get_conversation_prompt() -> ChatPromptTemplate:
    """
    Get conversation-aware RAG prompt
    
    Using conversation history in prompt
    
    Returns:
        ChatPromptTemplate with history placeholder
    """
    settings = get_settings()
    config = settings.prompt
    
    # Build rules string
    rules_text = "\n".join([f"{i+1}. {rule}" for i, rule in enumerate(config.rules)])
    
    # If the YAML has conversation_template, use it, else fallback
    if hasattr(config, 'conversation_template') and config.conversation_template:
        template = config.conversation_template.format(
            system_message=config.system_message,
            rules=rules_text,
            history="{history}",
            context="{context}",
            question="{question}"
        )
    else:
        template = f"""{config.system_message}

    RULES:
    {rules_text}

    CONVERSATION HISTORY:
    {{history}}

    DOCUMENT CONTEXT:
    {{context}}

    REQUIREMENT:
    - Answer like a tutor, explain clearly, step-by-step.
    - Every main conclusion/definition must cite source: filename, chapter/section, page.
    - If inferring beyond the document, must clearly mark as "inference".

    NEW QUESTION: {{question}}

    ANSWER:"""
    
    return ChatPromptTemplate.from_template(template)

def get_standalone_question_prompt() -> ChatPromptTemplate:
    """
    Prompt to rewrite a contextual query into a standalone query.
    Used for Advanced RAG Query Reformulation.
    """
    template = """Given the following conversation history and a new user question, rewrite the new question to be a standalone question that can be understood entirely on its own.
    
    CRITICAL INSTRUCTIONS:
    1. FOLLOW-UP: If the new question is a follow-up related to the conversation history, rewrite it to encompass the specific entity or subject mentioned previously.
    2. NEW TOPIC (TOPIC SHIFT): If the new question asks about a COMPLETELY NEW OR DIFFERENT TOPIC, DO NOT force a connection with the history. Simply return the new question EXACTLY as it is.
    3. Do NOT answer the question. ONLY return the rewritten standalone query.
    
    Conversation History:
    {history}
    
    New Question: {question}
    
    Standalone Question:"""
    return ChatPromptTemplate.from_template(template)

def get_followup_prompt() -> ChatPromptTemplate:
    """
    Get prompt for follow-up questions
    
    Learn: Context-aware follow-up handling
    """
    template = """Based on the previous conversation and new question, please answer consistently.

    HISTORY:
    {history}

    ADDITIONAL CONTEXT:
    {context}

    NEXT QUESTION: {question}

    ANSWER (keep consistency with previous answer):"""
    
    return ChatPromptTemplate.from_template(template)
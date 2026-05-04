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
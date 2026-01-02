"""Fallback template-based script generator."""

import logging
import re
from typing import List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FallbackRequest:
    """Request for fallback script generation."""

    book_content: str
    book_title: str
    book_author: Optional[str]
    episode_title: str
    podcaster_name: str
    episode_type: str  # MONOLOGUE, DUO, GROUP
    episode_theme: str  # LECTURE, DISCUSSION, DEBATE
    target_word_count: int


class FallbackGenerator:
    """Generate scripts using templates when LLM is unavailable."""

    # Transition phrases for variety
    TRANSITIONS = [
        "What I find particularly interesting is",
        "This reminds me of",
        "Let's dig deeper into",
        "Another key point here is",
        "What really stands out is",
        "It's worth noting that",
        "Building on this idea",
        "Consider for a moment",
        "The author makes a compelling case when",
        "This connects to a broader theme of",
    ]

    GUEST_REACTIONS = [
        "That's a great point.",
        "I hadn't thought about it that way.",
        "Exactly! And to add to that,",
        "I see it a bit differently.",
        "That resonates with me because",
        "Building on what you said,",
        "Here's what strikes me about that:",
        "I agree, and what's more,",
    ]

    CONCLUSIONS = [
        "So what's the takeaway here?",
        "Let's bring this all together.",
        "To wrap up our discussion,",
        "Here's what I want you to remember:",
        "The key insight from all of this is",
    ]

    def extract_key_sentences(
        self,
        content: str,
        count: int = 12,
    ) -> List[str]:
        """Extract meaningful sentences from book content."""
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', content)

        # Filter for quality sentences
        quality_sentences = []
        for sentence in sentences:
            sentence = sentence.strip()
            # Skip short, question-only, or fragment sentences
            if len(sentence) > 50 and len(sentence.split()) >= 8:
                # Skip sentences that are too long
                if len(sentence) < 300:
                    quality_sentences.append(sentence)

        # Take evenly distributed sentences
        if len(quality_sentences) <= count:
            return quality_sentences

        step = len(quality_sentences) // count
        return [quality_sentences[i * step] for i in range(count)]

    def generate_intro(
        self,
        request: FallbackRequest,
    ) -> str:
        """Generate episode introduction."""
        author_mention = f", written by {request.book_author}" if request.book_author else ""

        if request.episode_type == "MONOLOGUE":
            return f"""Welcome to the show! I'm {request.podcaster_name}, and today we're diving into something special - "{request.book_title}"{author_mention}.

In this episode, "{request.episode_title}", we're going to explore the key ideas and insights from this fascinating work. Whether you've read the book or are just curious about its themes, I think you'll find some valuable takeaways here.

So settle in, and let's get started."""

        elif request.episode_type == "DUO":
            return f"""HOST: Welcome back, everyone! I'm {request.podcaster_name}, and today we have a special episode for you. We're discussing "{request.book_title}"{author_mention}.

GUEST: Thanks for having me! I've been really looking forward to talking about this one.

HOST: Same here! For those just tuning in, our episode today is titled "{request.episode_title}". Let's dive right in."""

        else:  # GROUP
            return f"""HOST: Hello and welcome! I'm {request.podcaster_name}, and you're listening to a special discussion about "{request.book_title}"{author_mention}.

GUEST1: Excited to be here! This book has been on my list for a while.

GUEST2: Same! There's so much to unpack.

HOST: Perfect! Our episode is called "{request.episode_title}". Let's get into it."""

    def generate_body(
        self,
        request: FallbackRequest,
        key_sentences: List[str],
    ) -> str:
        """Generate the main body of the episode."""
        body_parts = []

        if request.episode_type == "MONOLOGUE":
            for i, sentence in enumerate(key_sentences):
                transition = self.TRANSITIONS[i % len(self.TRANSITIONS)]
                body_parts.append(f"{transition} this passage: \"{sentence}\"")
                body_parts.append("")  # Blank line for pacing

        elif request.episode_type == "DUO":
            for i, sentence in enumerate(key_sentences):
                if i % 2 == 0:
                    transition = self.TRANSITIONS[i % len(self.TRANSITIONS)]
                    body_parts.append(f"HOST: {transition} this part: \"{sentence}\"")
                else:
                    reaction = self.GUEST_REACTIONS[i % len(self.GUEST_REACTIONS)]
                    body_parts.append(f"GUEST: {reaction} When I read \"{sentence}\", I couldn't help but think about how it applies to our everyday lives.")
                body_parts.append("")

        else:  # GROUP
            speakers = ["HOST", "GUEST1", "GUEST2"]
            for i, sentence in enumerate(key_sentences):
                speaker = speakers[i % len(speakers)]
                if speaker == "HOST":
                    transition = self.TRANSITIONS[i % len(self.TRANSITIONS)]
                    body_parts.append(f"{speaker}: {transition} this insight: \"{sentence}\"")
                else:
                    reaction = self.GUEST_REACTIONS[i % len(self.GUEST_REACTIONS)]
                    body_parts.append(f"{speaker}: {reaction} The part where it says \"{sentence}\" really made me think.")
                body_parts.append("")

        return "\n".join(body_parts)

    def generate_conclusion(
        self,
        request: FallbackRequest,
    ) -> str:
        """Generate episode conclusion."""
        conclusion_starter = self.CONCLUSIONS[0]

        if request.episode_type == "MONOLOGUE":
            return f"""{conclusion_starter} "{request.book_title}" offers us valuable perspectives that we can apply in our own lives.

I hope this episode gave you some food for thought. If you enjoyed our exploration of these ideas, make sure to subscribe and leave a review. It helps more people discover these conversations.

Until next time, keep reading, keep thinking, and keep growing. This is {request.podcaster_name}, signing off."""

        elif request.episode_type == "DUO":
            return f"""HOST: {conclusion_starter} "{request.book_title}" gives us so much to think about.

GUEST: Absolutely. I'm walking away with a lot to reflect on.

HOST: Thanks so much for joining me today and sharing your insights.

GUEST: My pleasure! This was a great conversation.

HOST: And thank you all for listening. Don't forget to subscribe if you haven't already. This is {request.podcaster_name}, and we'll catch you next time!"""

        else:  # GROUP
            return f"""HOST: {conclusion_starter} We've covered a lot of ground with "{request.book_title}" today.

GUEST1: It's been such a rich discussion. I feel like I have new appreciation for the book now.

GUEST2: Same here. Hearing everyone's perspectives really added to my understanding.

HOST: That's what it's all about! Thanks to both of you for sharing your thoughts today.

GUEST1: Thank you for having us!

GUEST2: Always a pleasure!

HOST: And to our listeners, thank you for tuning in. Hit that subscribe button and we'll see you next time. Take care, everyone!"""

    def generate_script(self, request: FallbackRequest) -> str:
        """
        Generate a complete podcast script using templates.

        Args:
            request: Fallback generation request

        Returns:
            Complete podcast script
        """
        logger.info(f"Generating fallback script for: {request.episode_title}")

        # Calculate how many quotes we need based on target length
        # Roughly 150 words per minute, each section is about 100-150 words
        target_quotes = max(8, min(15, request.target_word_count // 200))

        key_sentences = self.extract_key_sentences(
            request.book_content,
            count=target_quotes,
        )

        if len(key_sentences) < 3:
            logger.warning("Not enough quality sentences extracted, using raw content")
            # Fall back to using chunks of the content
            words = request.book_content.split()
            chunk_size = len(words) // 5
            key_sentences = [
                " ".join(words[i * chunk_size:(i + 1) * chunk_size])
                for i in range(5)
            ]

        intro = self.generate_intro(request)
        body = self.generate_body(request, key_sentences)
        conclusion = self.generate_conclusion(request)

        script = f"{intro}\n\n{body}\n\n{conclusion}"

        logger.info(f"Generated fallback script with {len(script.split())} words")
        return script

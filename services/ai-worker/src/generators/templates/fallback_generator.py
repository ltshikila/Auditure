"""Fallback template-based script generator."""

import logging
import re
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class FallbackRequest:
    """Request for fallback script generation."""

    book_content: str
    book_title: str
    book_author: Optional[str]
    episode_title: str
    podcaster_name: str
    episode_type: str  # MONOLOGUE, DUO
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
        "Now here's something that really caught my attention",
        "Let me share something fascinating from this section",
        "This next part is crucial to understand",
        "I want to highlight something important here",
        "The more I think about this, the more I realize",
    ]

    # Extended commentary to add after quotes for more content
    COMMENTARY = [
        "This really makes you think about how we approach these situations in our own lives. When you break it down, the implications are quite significant for anyone looking to apply these principles.",
        "I think this is one of those insights that seems simple on the surface, but the more you sit with it, the more depth you discover. It's the kind of idea that can genuinely shift your perspective.",
        "What strikes me most about this is how universally applicable it is. Whether you're in business, education, or just navigating everyday life, this principle holds true time and time again.",
        "Now, some might disagree with this take, and that's fair. But I think when you look at the evidence and real-world examples, it's hard to argue with the core message here.",
        "This connects to something I've been thinking about a lot lately. In our current world, with all its complexity, these kinds of foundational ideas become even more relevant.",
        "If there's one thing I want you to take away from this section, it's the practical application. How can you use this in your daily routine? That's where the real value lies.",
        "The author really nails it here. This isn't just theoretical - it's backed by research and real experience. And that combination of rigor and practicality is what makes it so valuable.",
        "I've seen this play out so many times in different contexts. The pattern is unmistakable, and once you start recognizing it, you'll see it everywhere.",
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
    ) -> list[str]:
        """Extract meaningful sentences from book content."""
        # Split into sentences - handle multiple sentence-ending patterns
        sentences = re.split(r'(?<=[.!?])\s+', content)

        # Filter for quality sentences - relaxed criteria for technical content
        quality_sentences = []
        for sentence in sentences:
            sentence = sentence.strip()
            # Accept sentences with at least 30 chars and 5 words (relaxed from 50/8)
            if len(sentence) > 30 and len(sentence.split()) >= 5:
                # Accept sentences up to 400 chars (relaxed from 300)
                if len(sentence) < 400:
                    quality_sentences.append(sentence)

        logger.debug(f"Found {len(quality_sentences)} quality sentences from {len(sentences)} total")

        # Take evenly distributed sentences
        if len(quality_sentences) <= count:
            logger.debug(f"Returning all {len(quality_sentences)} quality sentences (requested {count})")
            return quality_sentences

        step = max(1, len(quality_sentences) // count)
        result = [quality_sentences[i * step] for i in range(min(count, len(quality_sentences)))]
        logger.debug(f"Selected {len(result)} evenly distributed sentences")
        return result

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

        else:  # DUO
            return f"""HOST: Welcome back, everyone! I'm {request.podcaster_name}, and today we have a special episode for you. We're discussing "{request.book_title}"{author_mention}.

GUEST: Thanks for having me! I've been really looking forward to talking about this one.

HOST: Same here! For those just tuning in, our episode today is titled "{request.episode_title}". Let's dive right in."""

    def generate_body(
        self,
        request: FallbackRequest,
        key_sentences: list[str],
    ) -> str:
        """Generate the main body of the episode."""
        body_parts = []

        if request.episode_type == "MONOLOGUE":
            for i, sentence in enumerate(key_sentences):
                transition = self.TRANSITIONS[i % len(self.TRANSITIONS)]
                commentary = self.COMMENTARY[i % len(self.COMMENTARY)]
                body_parts.append(f"{transition} this passage: \"{sentence}\"")
                body_parts.append("")
                body_parts.append(commentary)
                body_parts.append("")  # Blank line for pacing

        else:  # DUO
            for i, sentence in enumerate(key_sentences):
                if i % 2 == 0:
                    transition = self.TRANSITIONS[i % len(self.TRANSITIONS)]
                    commentary = self.COMMENTARY[i % len(self.COMMENTARY)]
                    body_parts.append(f"HOST: {transition} this part: \"{sentence}\"")
                    body_parts.append("")
                    body_parts.append(f"HOST: {commentary}")
                else:
                    reaction = self.GUEST_REACTIONS[i % len(self.GUEST_REACTIONS)]
                    guest_commentary = self.COMMENTARY[(i + 4) % len(self.COMMENTARY)]
                    body_parts.append(f"GUEST: {reaction} When I read \"{sentence}\", I couldn't help but think about how it applies to our everyday lives.")
                    body_parts.append("")
                    body_parts.append(f"GUEST: {guest_commentary}")
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

        else:  # DUO
            return f"""HOST: {conclusion_starter} "{request.book_title}" gives us so much to think about.

GUEST: Absolutely. I'm walking away with a lot to reflect on.

HOST: Thanks so much for joining me today and sharing your insights.

GUEST: My pleasure! This was a great conversation.

HOST: And thank you all for listening. Don't forget to subscribe if you haven't already. This is {request.podcaster_name}, and we'll catch you next time!"""

    def generate_script(self, request: FallbackRequest) -> str:
        """
        Generate a complete podcast script using templates.

        Args:
            request: Fallback generation request

        Returns:
            Complete podcast script
        """
        logger.info(f"Generating fallback script for: {request.episode_title}")
        logger.info(f"Target word count: {request.target_word_count}")

        # Calculate how many sections we need based on target length
        # Intro + conclusion ≈ 250 words
        # Each body section generates ~100 words (quote ~40 + transition ~10 + commentary ~50)
        # To meet target, we need: (target_words - 250) / 100 sections
        intro_conclusion_words = 250
        words_per_section = 100

        body_words_needed = max(500, request.target_word_count - intro_conclusion_words)
        target_sections = max(6, body_words_needed // words_per_section)

        # Cap at reasonable maximum but allow up to 25 sections for longer episodes
        target_sections = min(25, target_sections)

        logger.info(f"Targeting {target_sections} body sections for ~{body_words_needed + intro_conclusion_words} words")

        key_sentences = self.extract_key_sentences(
            request.book_content,
            count=target_sections,
        )

        logger.info(f"Extracted {len(key_sentences)} key sentences (target: {target_sections})")

        # Always pad if we don't have enough sentences to meet target
        if len(key_sentences) < target_sections:
            logger.warning(f"Only extracted {len(key_sentences)} sentences, padding to reach {target_sections}")
            words = request.book_content.split()
            needed = target_sections - len(key_sentences)

            if len(words) > 50:
                # Create chunks from the content to fill gaps
                chunk_size = max(20, min(50, len(words) // max(1, needed + 1)))
                for i in range(needed):
                    start = (i * chunk_size * 2) % max(1, len(words) - chunk_size)
                    chunk = " ".join(words[start:start + chunk_size])
                    if len(chunk) > 30:
                        # Trim to reasonable length and add ellipsis if needed
                        if len(chunk) > 150:
                            chunk = chunk[:150] + "..."
                        key_sentences.append(chunk)

            logger.info(f"After padding: {len(key_sentences)} sentences")

        intro = self.generate_intro(request)
        body = self.generate_body(request, key_sentences)
        conclusion = self.generate_conclusion(request)

        script = f"{intro}\n\n{body}\n\n{conclusion}"

        word_count = len(script.split())
        estimated_minutes = word_count / 185  # Gemini TTS speaks at ~185 wpm
        logger.info(
            f"Generated fallback script: {word_count} words, "
            f"~{estimated_minutes:.1f} minutes"
        )
        return script

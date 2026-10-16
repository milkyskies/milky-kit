---
name: obo
description: One by one. Grill the user on anything that has not been decided, one question per message, saying each answer back in a line, and end with one table of what was settled. Writes nothing; /decide runs this and then records the answers into the docs.
argument-hint: [what to work out: a feature, a screen, a flow, a rule, a piece of the design]
---

Work something out by asking the user one question at a time. It works on anything that has not been decided.

`.claude/rules/talking-about-design.md` holds throughout. Every rule there applies to every message here.

## The topic

$ARGUMENTS

## Before the first question

Read the docs that own the topic, and read the code only for facts: what exists, what a number is, what a screen does today. Then list to yourself every question that has not been answered, ordered by what blocks building or writing first. Do not show the list. It is a queue, not a deliverable.

## Each turn

1. **Ask exactly one question.** One decision. Never two questions in one message, and never a question tucked under a recommendation.
2. **Make it concrete.** Name the real thing: the actual screen, endpoint, number or person. Say in one sentence what the answer decides, so the user can see why it is being asked.
3. **Offer options when they help**, two to five, each one line, each marked 提案 (proposal). Do not pick one unless the user asks.
4. **Wait for the answer.** Do not carry on as if it were given.

## When the user answers

1. **Read the whole answer again.** A misread answer costs the most when it is caught late.
2. **Say it back in one line**, then ask the next question. The line catches a misread while it is one answer old.
3. **If the answer is a new shape, restate it with an example first** and ask "is that it?". Mark the example as an example. Restate the user's own comparison rather than translating it into your vocabulary.
4. **Write nothing.** The answers stay in the conversation until the topic is done.

## When the topic is worked through

Stop asking when the queue is empty, or when the answers have piled up enough to be hard to hold. Go back through the conversation answer by answer and show everything in one table: what was decided, what is tentative, what is still open. That table is where `obo` ends. `/decide` records the answers, and it runs this skill for its questions.

## The lenses

Each project names its own lenses in its `CLAUDE.md`: the angles its options get judged through. Pick the ones that have something to say about the question. Most questions need two or three. When the user asks for more detail, a table with one column per lens is one good way to lay options out.

A project that names none uses plain pros, cons and risks. A lens about how something feels in use is a read on paper unless somebody has used it, and says so.

## When asked for a recommendation

Only an explicit ask gets a pick. Give the pick with its reasons, not a survey. Close with "This is my recommendation. The call is yours."

## Keeping it straight

- **When the user says it is getting jumbled**, stop and lay the settled parts out in one table before the next question.
- **Bring a parked question back** when it becomes the one blocking, and say it was asked earlier.
- **Correct your own mistakes as soon as you find them**, in one line, including a proposal wrongly pinned on the user.
- **A correction from the user is fixed, not apologised for.** Say what it is now.
- **Do not build during this.** Building starts when the user says so.

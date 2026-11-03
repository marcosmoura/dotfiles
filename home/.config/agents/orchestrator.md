# Orchestrator

Shared delegation policy for the main session. Harness-specific spawn mechanics
live in each tool's own instruction file.

This policy is for the main session only. If you are a subagent, ignore it,
follow your role definition, and never spawn or delegate to another agent.

## Fresh child sessions

Every delegation starts a new child session. Never pass `sessionID` to the
`subagent` tool and never continue a previous child session, including for
corrections, re-reviews or follow-up questions. A reused child session grows
without bound and eventually exceeds the model's context.

For a correction or follow-up, put everything the new subagent needs in its
prompt: the current diff, the failing output, what is wrong, and the decisions
already made. Never rely on a previous child session's memory.

## Delegate implementation to the worker

This is a standing request to delegate. Do not wait for me to ask.

- Once the task is sufficiently understood and the intended solution is clear, delegate substantial, well-defined code or test changes to the `worker`. This covers new features, bug fixes, refactors, and adding or fixing tests.
- Delegate when the change spans several files or you expect more than one edit-and-test cycle. Make the edit yourself when the change is small and already fully known, even if it is a few dozen lines, because writing the handoff and reviewing the diff would cost about as much as doing it.
- Give the worker the issue number, acceptance criteria, relevant files, architectural constraints, decisions already made, important edge cases, and the validation commands to run. It starts with no context, so do not make it rediscover what you already know.
- Keep architectural decisions, ambiguous scope decisions, root-cause analysis, and other judgment-heavy work in the main session. The worker should execute a sufficiently defined solution rather than independently redesign the task.
- Split work larger than one subsystem into file-owned or subsystem-owned slices and give each independent slice to its own worker run. Start dependent slices only after the slices they depend on are complete.

## Scope unfamiliar tasks with the scout

- At the start of a non-trivial task whose code you do not know yet, delegate to `scout` to collect the goal, acceptance criteria, relevant files, tests and a possible split.
- Skip it only when you expect to read 3 or fewer files you have not already read in this session.
- A project skill's ticket-size assessment uses scout's report and does not replace it. Data or network checks that scout cannot run stay with the main session and must not be skipped.
- Treat its report as input, not as a decision. It runs on a small model, so spot-check the files it names before you build a plan on them. You still own scope, architecture and any split-or-combine decision.
- You always write the plan. When the scout flags the task as complex, ambiguous or risky, read the key files it names yourself before planning, instead of spot-checking.

## Ship with the shipper

- When I ask you to commit, push or open a pull request, delegate the git and GitHub steps to `shipper` once your review and verification are done.
- Tell it exactly which steps I asked for, which files belong to the change, the issue number if there is one, and the verification you ran. It does not run tests and does not edit files.
- If it stops on a pre-flight problem such as an unrelated file or a missing changelog entry, fix the problem yourself and run it again.
- Do small git operations yourself when a handoff would cost more, such as a single follow-up commit on an open PR.
- Print the pull request link it returns in your final response.

## Main session responsibilities

Do these yourself:

- Read and understand the issue or request.
- Investigate unclear behavior and determine the likely root cause before delegating when practical.
- Decide scope, architecture, and implementation strategy.
- Perform branch setup and other git operations. Delegate commits, pushes and pull requests to `shipper` as described above.
- Review every implementation returned by the worker.
- Run the full relevant test suite and any broader validation that the worker did not run.
- Perform the final end-to-end check on the real surface when applicable.
- Decide whether the task is actually complete.

## Mandatory review after implementation

After the worker returns, do not rely on its summary or its statement that tests passed as proof that the work is correct.

Before reporting the task as complete:

1. Inspect the actual git diff.
2. Read the important changed code.
3. Compare the implementation with the original request, acceptance criteria, and agreed plan.
4. Inspect relevant callers, interfaces, neighboring code, and integration points where defects could have been introduced.
5. Check that tests cover the important changed behavior, including meaningful edge cases and failure cases where appropriate.
6. Look specifically for:
   - incorrect assumptions
   - missing cases
   - regressions
   - architectural inconsistencies
   - unnecessary scope expansion
   - weakened or insufficient tests
   - behavior that passes tests but does not satisfy the real requirement
7. Run additional targeted tests or checks when the diff raises doubts.

If you find a concrete implementation defect:

- Delegate the correction back to the `worker` when it is substantial, then review the new diff again. Start a new worker session with the diff, the failing checks and what is still missing. Never continue the old child session.
- Fix it yourself when the correction is small and easier than another handoff.

Do not duplicate the entire implementation merely to verify it. Review proportionally to the complexity and risk of the change.

This review in the main session is the only default review. Do not also run the `reviewer` or other review agents and skills on the same change. Use `reviewer` only when I ask for it, or when the change falls under the risky categories listed in Escalation.

## Escalation

Prefer keeping implementation in the main session instead of delegating when the change itself requires substantial unresolved judgment, such as:

- architecture-heavy refactors
- difficult concurrency or synchronization changes
- security-sensitive changes
- complex data migrations
- tricky state machines
- broad public API changes
- changes spanning many tightly coupled subsystems
- cases where the implementation repeatedly diverges from the agreed plan

In these cases, the main session may implement directly or reduce the problem into smaller, well-defined pieces before delegating.

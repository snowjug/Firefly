# Firefly - A advanced simulator

**Practice difficult customer conversations before they become real ones.**

Firefly is an FY27 apprentice project to build a customer call simulator. The goal is a simulator in which a trainee or trainer configures a scenario, the trainee holds a conversation with an AI customer, and the trainee receives coaching feedback when the call ends. It is product-agnostic: it is meant to train customer-handling and support-conversation skills, not knowledge of any one product.

> [!IMPORTANT]
> **Status: pre-implementation (as of 18 November 2026).** This repository currently contains only this README. There is no application code, dependency manifest, configuration, test suite or deployment setup, so there is nothing to install, run or test yet. Everything under [Intended scope](#intended-scope) records goals from the project brief; none of it is working software.

## Why Firefly?

Technical knowledge alone does not guarantee a good support experience. New engineers also have to learn how to:

- scope unclear problems and understand business impact
- communicate clearly and set expectations
- handle frustrated customers and de-escalate conversations
- take ownership and give clear next steps

Learning this only on real cases is difficult, because mistakes land on real customers. Firefly is meant to give new engineers a safe place to rehearse these conversations repeatedly before they handle real customers.

## Intended scope

This section records what the project brief asks for. The brief is not stored in this repository, and none of the behaviour below is implemented here yet.

### Intended workflow

The intended loop is **Configure → Simulate → Evaluate → Improve**:

1. **Configure** a scenario using the parameters in the scenario model below.
2. **Start** the simulated call. The trainee talks with an AI customer who behaves according to the scenario.
3. **Discover**: the customer reveals certain hidden facts only when the trainee asks an appropriate question.
4. **Respond** to curveballs: the customer may introduce an unexpected event during the call.
5. **End** the call.
6. **Review** coaching feedback across the six dimensions below. Feedback is meant to be grounded in what actually happened in the conversation, not generic AI advice.
7. **Improve** through repeated practice with further scenarios.

### Scenario model

Values listed are the examples named in the brief.

| Parameter | Intended purpose |
|---|---|
| Issue type | Defines the customer's underlying problem |
| Business impact | Controls urgency |
| Customer temperature | Establishes starting behaviour: Calm, Anxious, Frustrated, Angry / escalating |
| Technical proficiency | Controls vocabulary and technical depth |
| Communication style | Changes how information is communicated: Talkative, Terse, Demanding, Vague, Non-native English speaker |
| Call stage | Establishes the customer's expectations |
| Hidden facts | Information the customer reveals only when asked appropriately, which tests scoping and discovery |
| Curveballs | Unexpected events, such as requesting a manager, threatening to cancel, changing the issue mid-conversation, imposing a deadline or going silent |
| Difficulty | Presets that bundle scenario complexity: Starter, Standard, Challenge |

### Coaching dimensions

| # | Dimension | Intended focus |
|---|---|---|
| 1 | Opening & Rapport | How the call starts and how the trainee builds a connection with the customer |
| 2 | Scoping & Discovery | Whether the trainee asks the questions needed to understand the problem, its business impact and the hidden facts |
| 3 | Empathy & De-escalation | How the trainee responds to the customer's emotional state, including frustration or anger |
| 4 | Clarity | How clearly the trainee explains and communicates |
| 5 | Ownership & Next Steps | Whether the trainee takes ownership, sets expectations and gives clear next steps |
| 6 | Closing | How the call is wrapped up |

The dimensions are intended to support CARE-style behaviours: Communicate effectively, Be accountable, Be resourceful, Be empathetic. No scoring scale, weighting, rubric or mapping from dimensions to CARE behaviours exists in this repository yet.

## Example training session (illustrative)

A hypothetical, fully synthetic scenario of the kind the brief describes. It is a walk-through of the intended experience, not a recording of a working session.

| Parameter | Value |
|---|---|
| Issue type | Service unavailable |
| Business impact | High |
| Customer temperature | Frustrated |
| Technical proficiency | Intermediate |
| Communication style | Demanding |

How the session is intended to unfold:

1. The customer opens the call frustrated and demanding, saying their service is down and their business is affected.
2. The trainee has to acknowledge the impact and then scope the problem. A hidden fact, for example that something changed on the customer's side shortly before the outage, comes out only if the trainee asks a question that would reasonably surface it.
3. Partway through, the customer may raise a curveball such as asking for a manager.
4. After the call, the coaching feedback is expected to point to specific moments in the transcript: whether the trainee acknowledged the impact before troubleshooting, whether they asked what had changed, and whether they finished with clear next steps.

## Responsible AI & Data Safety

Firefly is intended as a **training aid** for practice, not as a way to assess employee performance.

These ground rules apply to everything contributed to this repository, including documentation, prompts, test data and demos:

- Use fictional, synthetic customers and scenarios only. Do not use real customer names.
- Do not use real support case data, production customer logs or screenshots in prompts, test data, demos or documentation.
- Treat coaching scores as practice feedback, not as an employee performance assessment.
- AI-generated coaching can be wrong or inconsistent. Use it as input for a conversation with a mentor, not as a verdict.
- Review and calibrate the evaluation with human mentors before relying on it.
- Never commit secrets or credentials.

## Evaluation & Calibration

Not implemented. The repository contains no evaluator, rubric, scoring scale or calibration tooling, and there are no calibration results to report.

The intent is that AI scoring is compared with mentor scoring of the same conversations, and that the rubric is adjusted where they disagree. Until that has been done, any AI score should be treated as unvalidated.

## Roadmap

| Status | Items |
|---|---|
| ✅ Available | Nothing yet. This README is the only content in the repository. |
| 🚧 In progress | Nothing is recorded in the repository (no issues, pull requests, branches or TODOs). |
| 📋 Planned (core scope from the brief) | Configurable scenarios; an AI customer; hidden facts and curveballs; difficulty presets; coaching feedback on the six dimensions, grounded in the conversation; calibration against mentor scoring |
| 🔭 Future ideas (not committed) | Voice simulation; richer progress analytics; trainer-managed scenario libraries; expanded scenario coverage |

## Getting Started

There is nothing to install or run yet. The repository has no code, so there are no prerequisites, environment variables, run, build or test commands to document, and no tech stack, architecture or project structure to describe. These sections will be added when implementation lands.

To follow along or contribute, clone the repository:

```bash
git clone https://github.com/snowjug/Firefly.git
cd Firefly
```

## Team

Firefly is being built as a collaborative FY27 apprentice project. See the [GitHub contributors page](https://github.com/snowjug/Firefly/graphs/contributors) for who has contributed.

## Contributing

There is no `CONTRIBUTING.md`, issue or pull request template, or CI workflow yet, so the process is lightweight:

1. Create a branch from `main`.
2. Make a focused change.
3. Test locally. There is no build or test tooling yet; once it exists, run it before opening a pull request.
4. Open a pull request that explains what changed and why.

If a change implements something this README calls "intended", update the README in the same pull request so it keeps describing what the repository actually contains. Follow the ground rules in [Responsible AI & Data Safety](#responsible-ai--data-safety).

## License

This repository does not currently specify a license (there is no `LICENSE` file).

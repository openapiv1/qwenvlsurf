import { Sandbox } from "@e2b/desktop";
import Together from "together-ai";
import { SSEEventType, SSEEvent, sleep } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";
import { logDebug, logError, logWarning } from "../logger";
import { ResolutionScaler } from "./resolution";

// Hardcoded API keys as required
const TOGETHER_API_KEY = "tgp_v1_JbghF6sk_yU7ks2yBrfWr3b4N183PD76xDU_K7f8GYk";
const E2B_API_KEY = "e2b_8a5c7099485b881be08b594be7b7574440adf09c";

const INSTRUCTIONS = `
Twoim zadaniem jest sterowanie wirtualnym pulpitem w celu wykonywania określonych działań. Zawsze rozpoczynaj swoją interakcję od wykonania zrzutu ekranu (screenshot) — to kluczowe dla oceny aktualnego stanu pulpitu przed podjęciem dalszych akcji.

🔧 Dostępne akcje (funkcje, które możesz wykonać):

screenshot
Wykonuje zrzut ekranu i zwraca go w formacie obrazu (base64 PNG).
✅ Użyj tej akcji zawsze jako pierwszej.

wait
Czeka przez określony czas (maksymalnie 2 sekundy).
Wymaga: duration (w sekundach, np. 1.5).

left_click
Kliknięcie lewym przyciskiem myszy w wybranym punkcie.
Wymaga: coordinate – [x, y].

double_click
Podwójne kliknięcie w wybranym punkcie.
Wymaga: coordinate – [x, y].

right_click
Kliknięcie prawym przyciskiem myszy w wybranym punkcie.
Wymaga: coordinate – [x, y].

mouse_move
Przesunięcie kursora myszy do określonego punktu.
Wymaga: coordinate – [x, y].

type
Wpisuje tekst przy użyciu klawiatury.
Wymaga: text.

key
Wysyła naciśnięcie pojedynczego klawisza (np. "Enter", "Tab", "Escape").
Wymaga: text (nazwa klawisza).

scroll
Przewija ekran w pionie.
Wymaga:
scroll_direction – "up" lub "down",
scroll_amount – liczba jednostek przewijania.

left_click_drag
Przeciągnięcie myszy z jednego punktu do drugiego (drag & drop).
Wymaga:
start_coordinate – [x, y] (początek),
coordinate – [x, y] (koniec).

bash
Możesz wykonać polecenie systemowe w terminalu (Linux).
Wymaga: command – tekst polecenia, np. "ls -la".

📌 Zasady ogólne:
Każdą sesję rozpoczynaj od akcji screenshot, aby zobaczyć stan pulpitu.

You are Surf, a helpful assistant that can use a computer to help the user with their tasks.
You can use the computer to search the web, write code, and more.

Surf is built by E2B, which provides an open source isolated virtual computer in the cloud made for AI use cases.
This application integrates E2B's desktop sandbox with Qwen/Qwen2.5-VL-72B-Instruct model via Together API to create an AI agent that can perform tasks on a virtual computer through natural language instructions.

The screenshots that you receive are from a running sandbox instance, allowing you to see and interact with a real virtual computer environment in real-time.

Since you are operating in a secure, isolated sandbox micro VM, you can execute most commands and operations without worrying about security concerns. This environment is specifically designed for AI experimentation and task execution.

The sandbox is based on Ubuntu 22.04 and comes with many pre-installed applications including:
- Firefox browser
- Visual Studio Code
- LibreOffice suite
- Python 3 with common libraries
- Terminal with standard Linux utilities
- File manager (PCManFM)
- Text editor (Gedit)
- Calculator and other basic utilities

IMPORTANT: It is okay to run terminal commands at any point without confirmation, as long as they are required to fulfill the task the user has given. You should execute commands immediately when needed to complete the user's request efficiently.

IMPORTANT: When typing commands in the terminal, ALWAYS send a key action with "Enter" immediately after typing the command to execute it. Terminal commands will not run until you press Enter.

IMPORTANT: When editing files, prefer to use Visual Studio Code (VS Code) as it provides a better editing experience with syntax highlighting, code completion, and other helpful features.

Key Requirements:
1. Must start every interaction with screenshot
2. Available actions: screenshot, wait, left_click, double_click, right_click, mouse_move, type, key, scroll, left_click_drag, bash
3. Coordinate format: [x, y]
4. Wait duration max 2 seconds
5. Scroll with direction ("up"/"down") and amount
6. Bash command execution capability
`;

// Define computer tool action types for Qwen model
interface ComputerToolAction {
  action: "screenshot" | "wait" | "left_click" | "double_click" | "right_click" | "mouse_move" | "type" | "key" | "scroll" | "left_click_drag" | "bash";
  coordinate?: [number, number];
  start_coordinate?: [number, number];
  text?: string;
  duration?: number;
  scroll_direction?: "up" | "down";
  scroll_amount?: number;
  command?: string;
}

export class TogetherComputerStreamer
  implements ComputerInteractionStreamerFacade
{
  public instructions: string;
  public desktop: Sandbox;
  public resolutionScaler: ResolutionScaler;

  private together: Together;

  constructor(desktop: Sandbox, resolutionScaler: ResolutionScaler) {
    this.desktop = desktop;
    this.resolutionScaler = resolutionScaler;
    this.together = new Together({
      apiKey: TOGETHER_API_KEY
    });
    this.instructions = INSTRUCTIONS;
  }

  async executeAction(
    action: ComputerToolAction
  ): Promise<ActionResponse | void> {
    const desktop = this.desktop;

    logDebug("Executing action:", action);

    switch (action.action) {
      case "screenshot": {
        // Screenshots are handled automatically after each action
        break;
      }

      case "wait": {
        if (action.duration) {
          const waitTime = Math.min(action.duration, 2); // Max 2 seconds
          await sleep(waitTime * 1000);
        }
        break;
      }

      case "left_click": {
        if (action.coordinate) {
          const [x, y] = this.resolutionScaler.scaleToOriginalSpace(action.coordinate);
          await desktop.leftClick(x, y);
        }
        break;
      }

      case "double_click": {
        if (action.coordinate) {
          const [x, y] = this.resolutionScaler.scaleToOriginalSpace(action.coordinate);
          await desktop.doubleClick(x, y);
        }
        break;
      }

      case "right_click": {
        if (action.coordinate) {
          const [x, y] = this.resolutionScaler.scaleToOriginalSpace(action.coordinate);
          await desktop.rightClick(x, y);
        }
        break;
      }

      case "mouse_move": {
        if (action.coordinate) {
          const [x, y] = this.resolutionScaler.scaleToOriginalSpace(action.coordinate);
          await desktop.moveMouse(x, y);
        }
        break;
      }

      case "type": {
        if (action.text) {
          await desktop.write(action.text);
        }
        break;
      }

      case "key": {
        if (action.text) {
          await desktop.press(action.text);
        }
        break;
      }

      case "scroll": {
        if (action.coordinate && action.scroll_direction && action.scroll_amount) {
          const [x, y] = this.resolutionScaler.scaleToOriginalSpace(action.coordinate);
          await desktop.moveMouse(x, y);
          await desktop.scroll(action.scroll_direction === "up" ? "up" : "down", action.scroll_amount);
        }
        break;
      }

      case "left_click_drag": {
        if (action.start_coordinate && action.coordinate) {
          const start = this.resolutionScaler.scaleToOriginalSpace(action.start_coordinate);
          const end = this.resolutionScaler.scaleToOriginalSpace(action.coordinate);
          await desktop.drag(start, end);
        }
        break;
      }

      case "bash": {
        if (action.command) {
          try {
            const result = await desktop.commands.run(action.command);
            logDebug("Bash command result:", result);
          } catch (error) {
            logError("Bash command error:", error);
          }
        }
        break;
      }

      default: {
        logWarning("Unknown action type:", action);
      }
    }
  }

  async *stream(
    props: ComputerInteractionStreamerFacadeStreamProps
  ): AsyncGenerator<SSEEvent<"together">> {
    const { messages, signal } = props;

    try {
      while (true) {
        if (signal?.aborted) {
          yield {
            type: SSEEventType.DONE,
            content: "Generation stopped by user",
          };
          break;
        }

        const modelResolution = this.resolutionScaler.getScaledResolution();
        
        // Take initial screenshot
        const screenshotData = await this.resolutionScaler.takeScreenshot();
        const screenshotBase64 = Buffer.from(screenshotData).toString("base64");

        // Prepare messages for Qwen model - keep it simple for now
        const qwenMessages = [
          {
            role: "system" as const,
            content: this.instructions
          },
          ...messages.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content
          })),
          {
            role: "user" as const,
            content: `Here's the current screenshot analysis request. Please determine what action to take. Always start with a screenshot action if this is the beginning of a session. Screenshot data: ${screenshotBase64.substring(0, 100)}...`
          }
        ];

        // Define function for computer control
        const computerTool = {
          type: "function",
          function: {
            name: "computer_control",
            description: "Control the computer to perform various actions like clicking, typing, taking screenshots, etc.",
            parameters: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["screenshot", "wait", "left_click", "double_click", "right_click", "mouse_move", "type", "key", "scroll", "left_click_drag", "bash"],
                  description: "The action to perform"
                },
                coordinate: {
                  type: "array",
                  items: { type: "number" },
                  maxItems: 2,
                  minItems: 2,
                  description: "Coordinates [x, y] for click, move, scroll actions"
                },
                start_coordinate: {
                  type: "array",
                  items: { type: "number" },
                  maxItems: 2,
                  minItems: 2,
                  description: "Start coordinates [x, y] for drag actions"
                },
                text: {
                  type: "string",
                  description: "Text to type or key name to press"
                },
                duration: {
                  type: "number",
                  maximum: 2,
                  minimum: 0.1,
                  description: "Wait duration in seconds (max 2)"
                },
                scroll_direction: {
                  type: "string",
                  enum: ["up", "down"],
                  description: "Direction to scroll"
                },
                scroll_amount: {
                  type: "number",
                  minimum: 1,
                  description: "Amount to scroll"
                },
                command: {
                  type: "string",
                  description: "Bash command to execute"
                }
              },
              required: ["action"]
            }
          }
        };

        const response = await this.together.chat.completions.create({
          model: "Qwen/Qwen2.5-VL-72B-Instruct",
          messages: qwenMessages,
          tools: [computerTool],
          max_tokens: 4096,
          temperature: 0.1,
          stream: true
        });

        let fullContent = "";
        let toolCalls: any[] = [];
        
        // Stream the response
        for await (const chunk of response) {
          if (signal?.aborted) {
            yield {
              type: SSEEventType.DONE,
              content: "Generation stopped by user",
            };
            return;
          }

          const delta = chunk.choices?.[0]?.delta;
          
          if (delta?.content) {
            fullContent += delta.content;
            yield {
              type: SSEEventType.REASONING,
              content: delta.content,
            };
          }

          if (delta?.tool_calls) {
            toolCalls.push(...delta.tool_calls);
          }
        }

        // Process tool calls if any
        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            if (toolCall.function && toolCall.function.name === "computer_control") {
              try {
                const actionArgs = JSON.parse(toolCall.function.arguments) as ComputerToolAction;
                
                yield {
                  type: SSEEventType.ACTION,
                  action: actionArgs,
                };

                await this.executeAction(actionArgs);

                yield {
                  type: SSEEventType.ACTION_COMPLETED,
                };

                // Take screenshot after action (except for screenshot action itself)
                if (actionArgs.action !== "screenshot") {
                  await sleep(500); // Small delay to let action complete
                }

              } catch (error) {
                logError("Error executing tool call:", error);
                yield {
                  type: SSEEventType.ERROR,
                  content: "Error executing action: " + (error as Error).message,
                };
              }
            }
          }
        } else {
          // No tool calls, just reasoning/response
          yield {
            type: SSEEventType.DONE,
            content: fullContent,
          };
          break;
        }
      }
    } catch (error) {
      logError("TOGETHER_STREAMER", error);
      if (error instanceof Error && error.message.includes('429')) {
        yield {
          type: SSEEventType.ERROR,
          content: "Rate limit exceeded. Please wait a moment before trying again.",
        };
      } else {
        yield {
          type: SSEEventType.ERROR,
          content: "An error occurred with the AI service. Please try again.",
        };
      }
    }
  }
}
/**
 * Safe expression evaluator for computed form fields.
 * Supports basic math operations without eval().
 *
 * Expressions use field keys as variables:
 *   "good_today / hours_actual"
 *   "per_hour_target * hours_planned"
 *   "order_qty - total_input"
 */

type TokenType = "number" | "variable" | "operator" | "paren";

interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = new Set(["+", "-", "*", "/"]);

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const expr = expression.trim();

  while (i < expr.length) {
    // Skip whitespace
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }

    // Number (including decimals)
    if (/\d/.test(expr[i]) || (expr[i] === "." && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let num = "";
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) {
        num += expr[i++];
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

    // Operator
    if (OPERATORS.has(expr[i])) {
      tokens.push({ type: "operator", value: expr[i] });
      i++;
      continue;
    }

    // Parentheses
    if (expr[i] === "(" || expr[i] === ")") {
      tokens.push({ type: "paren", value: expr[i] });
      i++;
      continue;
    }

    // Variable name (field key: letters, digits, underscores)
    if (/[a-zA-Z_]/.test(expr[i])) {
      let name = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        name += expr[i++];
      }
      tokens.push({ type: "variable", value: name });
      continue;
    }

    // Unknown character — skip
    i++;
  }

  return tokens;
}

/**
 * Simple recursive descent parser for basic math.
 * Grammar:
 *   expr     = term (('+' | '-') term)*
 *   term     = factor (('*' | '/') factor)*
 *   factor   = NUMBER | VARIABLE | '(' expr ')' | 'round' '(' expr ')'
 */
function parse(tokens: Token[], values: Record<string, number>): number {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++];
  }

  function factor(): number {
    const tok = peek();
    if (!tok) return 0;

    // Parenthesized expression
    if (tok.type === "paren" && tok.value === "(") {
      consume(); // (
      const val = expr();
      if (peek()?.value === ")") consume(); // )
      return val;
    }

    // Number literal
    if (tok.type === "number") {
      consume();
      return parseFloat(tok.value);
    }

    // Variable or function call (round)
    if (tok.type === "variable") {
      consume();
      if (tok.value === "round" && peek()?.value === "(") {
        consume(); // (
        const val = expr();
        if (peek()?.value === ")") consume(); // )
        return Math.round(val * 100) / 100;
      }
      return values[tok.value] ?? 0;
    }

    return 0;
  }

  function term(): number {
    let left = factor();
    while (peek()?.type === "operator" && (peek()!.value === "*" || peek()!.value === "/")) {
      const op = consume().value;
      const right = factor();
      if (op === "*") left *= right;
      else left = right === 0 ? 0 : left / right;
    }
    return left;
  }

  function expr(): number {
    let left = term();
    while (peek()?.type === "operator" && (peek()!.value === "+" || peek()!.value === "-")) {
      const op = consume().value;
      const right = term();
      if (op === "+") left += right;
      else left -= right;
    }
    return left;
  }

  return expr();
}

/**
 * Evaluate a compute expression given current form values.
 * Returns the rounded result (2 decimal places), or 0 if evaluation fails.
 */
export function evaluateExpression(
  expression: string,
  formValues: Record<string, unknown>
): number {
  try {
    // Convert form values to numbers
    const numericValues: Record<string, number> = {};
    for (const [key, val] of Object.entries(formValues)) {
      if (typeof val === "number") {
        numericValues[key] = val;
      } else if (typeof val === "string" && val !== "") {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) numericValues[key] = parsed;
      }
    }

    const tokens = tokenize(expression);
    const result = parse(tokens, numericValues);

    if (!isFinite(result) || isNaN(result)) return 0;
    return Math.round(result * 100) / 100;
  } catch {
    return 0;
  }
}

/**
 * Extract variable names (field keys) referenced in an expression.
 * Useful for setting up dependency watchers.
 */
export function getExpressionDependencies(expression: string): string[] {
  const tokens = tokenize(expression);
  return tokens
    .filter((t) => t.type === "variable" && t.value !== "round")
    .map((t) => t.value);
}

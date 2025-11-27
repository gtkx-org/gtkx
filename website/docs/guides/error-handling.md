---
sidebar_position: 6
---

# Error Handling

This guide covers how to handle errors from native GTK/GLib functions in GTKX applications.

## NativeError

When a GTK or GLib function fails, GTKX throws a `NativeError`. This is a JavaScript Error subclass that wraps the underlying GLib `GError` and provides access to its properties.

```tsx
import { NativeError } from "@gtkx/ffi";
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | The human-readable error message |
| `domain` | `number` | The GLib error domain (GQuark) |
| `code` | `number` | The error code within the domain |
| `ptr` | `unknown` | The raw GError pointer |
| `name` | `string` | Always `"NativeError"` |
| `stack` | `string` | JavaScript stack trace |

## Catching Errors

Use standard try-catch blocks to handle native errors:

```tsx
import { NativeError } from "@gtkx/ffi";
import { KeyFile } from "@gtkx/ffi/glib";

const loadConfig = (path: string) => {
  const keyFile = new KeyFile();

  try {
    keyFile.loadFromFile(path, KeyFileFlags.NONE);
    return keyFile.getString("Settings", "username");
  } catch (err) {
    if (err instanceof NativeError) {
      console.error(`Config error: ${err.message}`);
      console.error(`Domain: ${err.domain}, Code: ${err.code}`);
      return null;
    }
    throw err; // Re-throw non-native errors
  }
};
```

## Common Error Scenarios

### File Operations

```tsx
import { NativeError } from "@gtkx/ffi";
import { KeyFile, KeyFileFlags } from "@gtkx/ffi/glib";

const keyFile = new KeyFile();

try {
  keyFile.loadFromFile("/nonexistent/path", KeyFileFlags.NONE);
} catch (err) {
  if (err instanceof NativeError) {
    // err.message: "Failed to open file "/nonexistent/path": No such file or directory"
    console.error(err.message);
  }
}
```

### Missing Keys

```tsx
try {
  const value = keyFile.getString("NonExistentGroup", "key");
} catch (err) {
  if (err instanceof NativeError) {
    // err.message: "Key file does not have group "NonExistentGroup""
    console.error(err.message);
  }
}
```

## Error Domains and Codes

GLib errors are categorized by domain (a GQuark identifier) and code. You can use these to handle specific error types:

```tsx
import { NativeError } from "@gtkx/ffi";

try {
  // Some operation that might fail
} catch (err) {
  if (err instanceof NativeError) {
    // Check for specific error conditions
    if (err.code === 4) {
      // Handle specific error code
    }
  }
}
```

## Best Practices

### Always Check Error Type

Since GTKX mixes JavaScript and native code, always verify the error type:

```tsx
try {
  await someOperation();
} catch (err) {
  if (err instanceof NativeError) {
    // Handle native GTK/GLib error
    handleNativeError(err);
  } else if (err instanceof Error) {
    // Handle JavaScript error
    handleJsError(err);
  } else {
    throw err;
  }
}
```

### Provide User-Friendly Messages

Native error messages are often technical. Consider mapping them to user-friendly messages:

```tsx
const getUserMessage = (err: NativeError): string => {
  if (err.message.includes("No such file")) {
    return "The file could not be found.";
  }
  if (err.message.includes("Permission denied")) {
    return "You don't have permission to access this file.";
  }
  return "An unexpected error occurred.";
};
```

### Log Full Error Details

For debugging, log the complete error information:

```tsx
const logNativeError = (err: NativeError, context: string) => {
  console.error(`[${context}] NativeError:`, {
    message: err.message,
    domain: err.domain,
    code: err.code,
    stack: err.stack,
  });
};
```

## Integration with React

### Error Boundaries

Use React error boundaries to catch errors during rendering:

```tsx
import { Component, ReactNode } from "react";
import { NativeError } from "@gtkx/ffi";

interface State {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const message = this.state.error instanceof NativeError
        ? `Native error: ${this.state.error.message}`
        : `Error: ${this.state.error.message}`;

      return <Label.Root label={message} />;
    }
    return this.props.children;
  }
}
```

### Handling Errors in Event Handlers

Errors in event handlers won't be caught by error boundaries. Handle them explicitly:

```tsx
const MyComponent = () => {
  const [error, setError] = useState<string | null>(null);

  const handleLoad = () => {
    try {
      loadData();
      setError(null);
    } catch (err) {
      if (err instanceof NativeError) {
        setError(err.message);
      }
    }
  };

  return (
    <Box>
      {error && <Label.Root label={error} cssClasses={["error"]} />}
      <Button label="Load" onClicked={handleLoad} />
    </Box>
  );
};
```

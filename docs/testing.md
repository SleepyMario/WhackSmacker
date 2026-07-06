# Testing

## Node Test Runner and Sandbox Notes

The normal project command is:

```sh
npm test
```

It runs `npm run build` through `pretest`, then runs:

```sh
node --test --test-concurrency=1 test/*.test.mjs
```

On Node `v24.14.0` with npm `11.9.0`, this command passed outside the managed filesystem sandbox with all project tests passing.

Inside the managed sandbox used during development automation, the same command can fail before selected test files execute their assertions. The failure mode is a native Node assertion from the built-in test runner:

```text
Assertion failed: (env_->execution_async_id()) == (0)
```

Small groups of test files and individual test files can pass, and the affected project assertions are not reached. A plain module execution of a loopback-using test also fails in the sandbox with `listen EPERM` on `127.0.0.1`, which supports the conclusion that the sandbox restrictions are involved.

Current recommendation:

```sh
npm test
```

Run it outside the managed sandbox when validating changes that exercise local HTTP servers or child processes. If only the sandboxed environment is available, individual focused test files may still be useful, but a sandboxed native Node assertion should not be treated as a WhackSmacker assertion failure without rerunning outside the sandbox.

Unresolved: the exact Node test-runner interaction with the managed sandbox has not been isolated to a minimal upstream reproduction.

#!/usr/bin/env node

import { main } from "../apps/cli/main";
import { redactDatabaseError } from "../packages/storage/postgres";

void main().catch(error=>{console.error(redactDatabaseError(error));process.exitCode=1});

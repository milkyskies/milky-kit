import { Data } from "effect";

// Domain / application errors. Routes throw these and the error-handler
// (presentation/error-handler.ts) maps them to HTTP responses. Keeps
// route handlers free of HTTP-status logic.

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
	firebaseUid: string;
}> {}

export class UserAlreadyExists extends Data.TaggedError("UserAlreadyExists")<{
	firebaseUid: string;
}> {}

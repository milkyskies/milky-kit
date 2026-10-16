export const EXIT = {
	refused: 1,
	usage: 2,
	external: 3,
	mismatch: 4,
} as const

export type ExitCode = (typeof EXIT)[keyof typeof EXIT]

export class DeskError extends Error {
	readonly exitCode: ExitCode

	constructor(exitCode: ExitCode, message: string) {
		super(message)
		this.exitCode = exitCode
	}
}

export function usageError(command: string, detail: string): DeskError {
	return new DeskError(EXIT.usage, `desk: ${command}: ${detail}`)
}

export function refusal(
	command: string,
	issue: number,
	saw: string,
	expected?: string,
	fix?: string,
): DeskError {
	const expectation = expected === undefined ? "" : `, expected ${expected}`
	const remedy = fix === undefined ? "" : ` Fix: ${fix}`

	return new DeskError(
		EXIT.refused,
		`desk: ${command} #${issue} refused: ${saw}${expectation}${remedy}`,
	)
}

export function mismatch(
	command: string,
	issue: number,
	before: string,
	after: string,
	expected: string,
): DeskError {
	return new DeskError(
		EXIT.mismatch,
		`desk: ${command} #${issue} wrote its comment, but the second read shows ${after} (before: ${before}), expected ${expected}`,
	)
}

import { join } from "node:path"

import { type DeskSection, readDeskSection } from "../project/section.ts"
import { type Orca, spawnOrca } from "./runner.ts"

export type OrcaDeps = {
	orca: Orca
	loadSection: () => Promise<DeskSection>
}

export function realOrcaDeps(): OrcaDeps {
	return {
		orca: spawnOrca,
		loadSection: () => readDeskSection(join(process.cwd(), "CLAUDE.md")),
	}
}

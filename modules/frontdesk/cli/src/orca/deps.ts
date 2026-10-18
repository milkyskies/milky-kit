import { join } from "node:path"

import { type FrontdeskSection, readFrontdeskSection } from "../project/section.ts"
import { type Orca, spawnOrca } from "./runner.ts"

export type OrcaDeps = {
	orca: Orca
	loadSection: () => Promise<FrontdeskSection>
}

export function realOrcaDeps(): OrcaDeps {
	return {
		orca: spawnOrca,
		loadSection: () => readFrontdeskSection(join(process.cwd(), "CLAUDE.md")),
	}
}

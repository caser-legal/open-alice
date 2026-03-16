/**
 * ============================================================================
 * SKILL INJECTOR - Auto-loads skills and injects into system prompt
 * ============================================================================
 * 
 * This module scans ~/.claude/skills/ for available skills,
 * matches user input to skill triggers, and injects full skill content
 * into the system prompt before sending to Claude Code.
 * 
 * USAGE:
 *   import { injectSkills } from './core/skill-injector.js'
 *   
 *   const { systemPrompt, appendSystemPrompt, loadedSkills } = await injectSkills(userInput)
 *   
 *   await askClaudeCode(userInput, { systemPrompt, appendSystemPrompt })
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const SKILLS_DIR = join(homedir(), '.claude', 'skills')

interface SkillMatch {
  name: string
  path: string
  content: string
  priority: number
  triggers: string[]
}

/**
 * Skill trigger patterns - maps keywords to skill names
 * Add/modify based on your skill collection
 */
const SKILL_TRIGGERS: Record<string, string[]> = {
  // DEBUGGING & FIXES
  'systematic-debugging': ['bug', 'error', 'fail', 'broken', 'crash', 'issue', 'problem', 'debug', 'troubleshoot'],
  
  // TESTING
  'test-driven-development': ['test', 'tdd', 'coverage', 'spec'],
  'tdd-guide': ['tdd', 'test first', 'red green refactor'],
  
  // CODE REVIEW
  'gstack-review': ['review', 'pr', 'pull request', 'code quality'],
  'code-reviewer': ['review code', 'audit code'],
  
  // BROWSER
  'gstack-browse': ['browser', 'scrape', 'crawl', 'screenshot', '@e', '@c', 'snapshot'],
  'gstack-qa': ['qa', 'test website', 'check page'],
  
  // PLANNING
  'gstack-plan-eng-review': ['plan', 'architecture', 'design', 'tech lead'],
  'gstack-plan-ceo-review': ['ceo', 'strategy', 'founder', 'vision'],
  
  // BACKEND
  'senior-backend': ['api', 'backend', 'database', 'sql', 'endpoint'],
  'docker-development': ['docker', 'container', 'deploy', 'ci/cd'],
  
  // SECURITY
  'skill-security-auditor': ['security', 'vulnerability', 'audit', 'owasp'],
  
  // MARKETING
  'content-creator': ['content', 'blog', 'post', 'article', 'seo'],
  'copywriting': ['copy', 'landing page', 'headline', 'cta'],
  
  // C-LEVEL
  'ceo-advisor': ['ceo', 'strategy', 'board', 'investor'],
  'cto-advisor': ['cto', 'tech debt', 'scalability', 'team scaling'],
  'cfo-advisor': ['cfo', 'financial', 'burn rate', 'cac', 'ltv'],
  
  // PRODUCT
  'agile-product-owner': ['product owner', 'backlog', 'user story', 'sprint'],
  'ux-researcher-designer': ['ux', 'user research', 'usability'],
}

/**
 * Scan skills directory and return list of available skill files
 */
async function scanSkills(): Promise<string[]> {
  try {
    const files = await readdir(SKILLS_DIR)
    return files.filter(f => f.endsWith('.md'))
  } catch (error) {
    console.error('[SkillInjector] Failed to scan skills directory:', error)
    return []
  }
}

/**
 * Load a skill file and extract frontmatter + content
 */
async function loadSkill(filename: string): Promise<{ name: string; content: string; description?: string } | null> {
  try {
    const filePath = join(SKILLS_DIR, filename)
    const content = await readFile(filePath, 'utf-8')
    
    // Extract name from frontmatter or filename
    const nameMatch = content.match(/^---\s*\nname:\s*(.+)\s*\n/m)
    const name = nameMatch ? nameMatch[1].trim() : filename.replace('.md', '')
    
    // Extract description from frontmatter
    const descMatch = content.match(/^---\s*\n.*description:\s*(.+)\s*\n/m)
    const description = descMatch ? descMatch[1].trim() : undefined
    
    return { name, content, description }
  } catch (error) {
    console.error(`[SkillInjector] Failed to load skill ${filename}:`, error)
    return null
  }
}

/**
 * Match user input to relevant skills based on trigger keywords
 */
function matchSkills(input: string, availableSkills: Array<{ name: string; path: string }>): SkillMatch[] {
  const matches: SkillMatch[] = []
  const inputLower = input.toLowerCase()
  
  for (const [skillName, triggers] of Object.entries(SKILL_TRIGGERS)) {
    // Check if this skill is available
    const skillFile = availableSkills.find(s => s.name === skillName || s.name.includes(skillName))
    if (!skillFile) continue
    
    // Check if any trigger matches
    const matchedTriggers = triggers.filter(t => inputLower.includes(t))
    if (matchedTriggers.length > 0) {
      matches.push({
        name: skillName,
        path: skillFile.path,
        content: '', // Will be loaded later
        priority: matchedTriggers.length,
        triggers: matchedTriggers,
      })
    }
  }
  
  // Sort by priority (most matches first)
  return matches.sort((a, b) => b.priority - a.priority)
}

/**
 * Main injection function
 * 
 * @param userInput - The user's input message
 * @param maxSkills - Maximum number of skills to load (default: 3)
 * @returns Object with systemPrompt and appendSystemPrompt for Claude Code
 */
export async function injectSkills(
  userInput: string,
  maxSkills: number = 3
): Promise<{
  systemPrompt?: string
  appendSystemPrompt?: string
  loadedSkills: string[]
  hasSkills: boolean
}> {
  // Scan available skills
  const skillFiles = await scanSkills()
  const availableSkills = skillFiles.map(f => ({ name: f.replace('.md', ''), path: join(SKILLS_DIR, f) }))
  
  // Match user input to skills
  const matchedSkills = matchSkills(userInput, availableSkills)
  
  if (matchedSkills.length === 0) {
    return {
      systemPrompt: undefined,
      appendSystemPrompt: undefined,
      loadedSkills: [],
      hasSkills: false,
    }
  }
  
  // Load top N skills
  const skillsToLoad = matchedSkills.slice(0, maxSkills)
  const loadedSkillContents: string[] = []
  const loadedSkillNames: string[] = []
  
  for (const skill of skillsToLoad) {
    const loaded = await loadSkill(join(SKILLS_DIR, `${skill.name}.md`))
    if (loaded) {
      skill.content = loaded.content
      loadedSkillContents.push(`<skill name="${skill.name}">\n${loaded.content}\n</skill>`)
      loadedSkillNames.push(`${skill.name} (triggered: ${skill.triggers.join(', ')})`)
    }
  }
  
  // Build system prompt injection
  const appendSystemPrompt = `
<ACTIVE_SKILLS_INJECTION>
You have ${loadedSkillNames.length} specialized skill(s) auto-loaded for this request:

${loadedSkillContents.join('\n\n')}

CRITICAL INSTRUCTIONS:
1. You MUST follow these skill methodologies EXACTLY
2. Do NOT mention skill names unless explicitly asked
3. Do NOT ask permission - EXECUTE the skill protocols AUTONOMOUSLY
4. Apply the skill frameworks immediately to the user's request
5. These skills override your default behavior for this task

Execute the skill protocols now.
</ACTIVE_SKILLS_INJECTION>
`.trim()
  
  return {
    systemPrompt: undefined,
    appendSystemPrompt,
    loadedSkills: loadedSkillNames,
    hasSkills: true,
  }
}

/**
 * Get all available skills (for debugging/admin)
 */
export async function listAllSkills(): Promise<Array<{ name: string; description?: string }>> {
  const skillFiles = await scanSkills()
  const skills: Array<{ name: string; description?: string }> = []
  
  for (const file of skillFiles) {
    const loaded = await loadSkill(join(SKILLS_DIR, file))
    if (loaded) {
      skills.push({ name: loaded.name, description: loaded.description })
    }
  }
  
  return skills
}

// Export singleton instance
export const skillInjector = {
  inject: injectSkills,
  list: listAllSkills,
}

export default skillInjector

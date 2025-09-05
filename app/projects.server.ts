import { promisify } from "node:util";
import { execFile as _execFile } from "node:child_process";
import { homedir } from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const execFile = promisify(_execFile);

export type Project = { name: string; modified: string; modifiedTime: number };

export async function getProjects() {
  const dir = path.join(homedir(), ".claude", "projects");
  try {
    // Get all project directories
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const projects: Project[] = [];

    // Process each project directory
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "." || entry.name === "..") continue;

      const projectDir = path.join(dir, entry.name);
      let mostRecentTime = 0;
      let mostRecentDate = "";

      try {
        // Read all files in the project directory
        const files = await fs.readdir(projectDir);
        
        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;
          
          const filePath = path.join(projectDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() > mostRecentTime) {
            mostRecentTime = stats.mtime.getTime();
            const date = stats.mtime;
            
            // Format the date to match the original format
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = months[date.getMonth()];
            const day = date.getDate();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const currentYear = new Date().getFullYear();
            
            // Use time format for current year, year for older
            if (date.getFullYear() === currentYear) {
              mostRecentDate = `${month} ${day} ${hours}:${minutes}`;
            } else {
              mostRecentDate = `${month} ${day} ${date.getFullYear()}`;
            }
          }
        }
        
        // Only add project if it has session files
        if (mostRecentTime > 0) {
          projects.push({ 
            name: entry.name, 
            modified: mostRecentDate,
            modifiedTime: mostRecentTime
          });
        }
      } catch (error) {
        // Skip projects we can't read
        console.error(`Failed to read project ${entry.name}:`, error);
      }
    }

    // Sort by most recent first
    projects.sort((a, b) => b.modifiedTime - a.modifiedTime);

    return { dir, projects };
  } catch (error) {
    return {
      dir,
      projects: [],
      error: `Failed to read directory: ${(error as Error).message}`,
    };
  }
}
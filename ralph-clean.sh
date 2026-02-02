#!/bin/bash
# ralph-clean.sh - Archive ralph docs and complete phase beans before PR merge

BRANCH=$(git branch --show-current | tr '/' '-')
TIMESTAMP=$(date +%Y-%m-%d-%H-%M)
ARCHIVE_DIR="ralph-archive/${TIMESTAMP}-${BRANCH}-ralph"

if [ ! -d "ralph" ]; then
    echo "No ralph/ directory found"
    exit 1
fi

mkdir -p "$ARCHIVE_DIR"
cp -r ralph/* "$ARCHIVE_DIR/"

# Archive root-level ralph files
[ -f "prompt.md" ] && cp prompt.md "$ARCHIVE_DIR/" && rm prompt.md
[ -f "progress.txt" ] && cp progress.txt "$ARCHIVE_DIR/" && rm progress.txt

# Mark phase beans as completed
if command -v beans &> /dev/null; then
    echo "Completing phase beans..."
    beans query '{ beans(filter: { search: "Phase", excludeStatus: ["completed", "scrapped"] }) { id title } }' --json 2>/dev/null | \
        jq -r '.data.beans[].id' 2>/dev/null | \
        while read -r id; do
            beans update "$id" --status completed 2>/dev/null && echo "  Completed: $id"
        done
fi

# Remove ralph directory
rm -rf ralph/

echo "Archived to: $ARCHIVE_DIR"
echo "ralph/, prompt.md, progress.txt cleaned up"

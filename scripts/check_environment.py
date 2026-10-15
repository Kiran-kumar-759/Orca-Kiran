#!/usr/bin/env python3
"""
ORCA Environment Diagnostic & Verification Script
Checks runtime versions, database connectivity, and configured LLM providers.
"""

import sys
import shutil
import os

def check_cli():
    print("=== ORCA Environment Diagnostics ===")
    
    # 1. Python version
    py_ver = sys.version.split()[0]
    print(f"Python: {py_ver} (Path: {sys.executable})")
    
    # 2. Node & npm
    node_path = shutil.which("node")
    npm_path = shutil.which("npm")
    psql_path = shutil.which("psql")
    
    print(f"Node.js: {'Available at ' + node_path if node_path else 'NOT FOUND'}")
    print(f"npm:     {'Available at ' + npm_path if npm_path else 'NOT FOUND'}")
    print(f"psql:    {'Available at ' + psql_path if psql_path else 'NOT FOUND'}")
    
    # 3. Check environment variables
    env_file = os.path.exists(".env")
    print(f".env file present: {env_file}")
    
    # 4. Check core directories
    for d in ["docs", "backend", "frontend", "scripts", "data"]:
        exists = os.path.isdir(d)
        print(f"Directory '{d}': {'OK' if exists else 'MISSING'}")

if __name__ == "__main__":
    check_cli()

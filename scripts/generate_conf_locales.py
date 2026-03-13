#!/usr/bin/env python3


import re
import json
import os
import sys

def main():
    script_dir = os.path.dirname(os.path.realpath(__file__))
    conf_file = os.path.join(os.path.dirname(script_dir), 'nzbget.conf')
    merge_file = None
    if len(sys.argv) > 1:
        conf_file = sys.argv[1]
    if len(sys.argv) > 2:
        merge_file = sys.argv[2]
    with open(conf_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    locales = {}
    keys_to_delete = set()  # Track keys that will be regenerated from nzbget.conf
    if merge_file and os.path.exists(merge_file):
        with open(merge_file, 'r', encoding='utf-8') as f:
            locales = json.load(f)
    current_comments = []

# Matches category header lines like "### Category Name ###"
    # Pattern: ### followed by category name (captured), then ### (with optional surrounding whitespace)
    cat_re = re.compile(r'^###\s+(.+?)\s+###$')

    # Matches option key-value pairs (both active and commented)
    # Pattern: optional #, then option name, then = and value
    opt_re = re.compile(r'^#?([a-zA-Z0-9_.]+)=(.*)$')

    # Regex to check if line is a commented option (starts with # followed by OptionName=)
    commented_opt_re = re.compile(r'^#([a-zA-Z0-9_.]+)=.*$')

    for line in lines:
        line_stripped = line.strip()
        cat_match = cat_re.match(line_stripped)
        if cat_match:
            current_comments = []
            continue
        
        # Check if this is a commented option like "#OptionName=Value"
        is_commented_opt = commented_opt_re.match(line_stripped)
        
        # If it's a commented option, we need to check if it's a real option or just a comment
        # A commented option has format: #OptionName=Value (no space between # and OptionName)
        if is_commented_opt:
            # Extract option name from commented option
            opt_name = is_commented_opt.group(1)
            opt_value = line_stripped[len(f'#{opt_name}='):].strip()
            is_option = True
        else:
            # Check for active option
            opt_match = opt_re.match(line_stripped)
            if opt_match:
                opt_name = opt_match.group(1)
                opt_value = opt_match.group(2).strip()
                is_option = True
            else:
                is_option = False
        
        if is_option:
            
            # Remove trailing digits from first part to get base key (Server1.Name -> server_name)
            parts = opt_name.split('.')
            if len(parts) >= 2:
                first_part = parts[0]
                rest_parts = parts[1:]
                # Remove trailing digits from first part (Server1 -> Server)
                base_name = re.sub(r'[0-9]+$', '', first_part)
                # Rebuild key with base name
                opt_key = (base_name + '_' + '_'.join(rest_parts)).lower()
            else:
                opt_key = opt_name.replace('.', '_').lower()
            
            if current_comments:
                first_line = current_comments[0]
                pstart = first_line.rfind('(')
                pend = first_line.rfind(')')
                if pstart > -1 and pend > -1 and pend == len(first_line) - 2 and first_line.endswith('.'):
                    current_comments[0] = first_line[:pstart].strip() + '.'
            
            # Preserve ALL line breaks from nzbget.conf:
            # - Single \n for regular line continuations (not paragraph breaks)
            # - \n\n for paragraph breaks (empty # lines)
            # This ensures exact formatting from nzbget.conf is preserved
            temp_comments = []
            for i, comment in enumerate(current_comments):
                if comment == '\x00':
                    # Empty # line = paragraph break
                    # But check if there's already a pending newline
                    if temp_comments and temp_comments[-1] == '\n':
                        # Replace trailing \n with \n\n
                        temp_comments[-1] = '\n\n'
                    else:
                        temp_comments.append('\n\n')
                else:
                    # Regular comment line
                    temp_comments.append(comment)
                    # Add newline after this comment (but not after the last one and not before paragraph)
                    if i < len(current_comments) - 1:
                        next_is_paragraph = current_comments[i + 1] == '\x00'
                        if not next_is_paragraph:
                            temp_comments.append('\n')
            
            desc_message = ''.join(temp_comments)
            
            # Now we need to clean up: remove extra \n at start/end and handle double \n\n
            desc_message = desc_message.strip()
            
            if desc_message:
                desc_hint = f"Description for the option {opt_name}"
                if re.search(r'<[^>]+>', desc_message):
                    desc_hint += " DO NOT translate option names enclosed in angle brackets (e.g., <OptionName>)."
                if re.search(r'"[^"]+"', desc_message):
                    desc_hint += " DO NOT translate technical values enclosed in quotes."
                if re.search(r'(NOTE:|WARNING:|INFO:|INFO FOR DEVELOPERS:|MORE INFO:)', desc_message):
                    desc_hint += " DO NOT translate the exact uppercase keywords (NOTE:, WARNING:, INFO:, INFO FOR DEVELOPERS:, MORE INFO:) as they are used to render UI badges."
                
                key = f"config_desc_{opt_key}"
                locales[key] = {
                    "message": desc_message,
                    "description": desc_hint
                }
                keys_to_delete.add(key)
            
            current_comments = []
            continue

        if line_stripped.startswith('#'):
            if line_stripped.startswith('####'):
                continue
            comment_text = line_stripped[1:]
            if comment_text.startswith(' '):
                comment_text = comment_text[1:]
            # Only treat a lone '#' (empty line) as a paragraph break marker
            # Don't include it in the output, but mark its position for later processing
            if comment_text == '':
                current_comments.append('\x00')  # Placeholder for paragraph break
            else:
                current_comments.append(comment_text)
            continue
            
        if not line_stripped:
            current_comments = []

    obsolete_keys = [k for k in locales.keys() if k.startswith('config_desc_') and k not in keys_to_delete]
    for k in obsolete_keys:
        del locales[k]

    json.dump(locales, sys.stdout, indent=4, ensure_ascii=False)
    print()

if __name__ == '__main__':
    main()

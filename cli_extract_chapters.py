import os
import sys
import subprocess
import json
import argparse

def get_chapter_lengths(file_path):
    try:
        # Use ffprobe to get chapters
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_chapters', '-show_format', file_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        data = json.loads(result.stdout)

        duration = float(data.get('format', {}).get('duration', 0))
        chapters = data.get('chapters', [])

        out_txt = []
        if not chapters:
            print("No embedded chapters found in this file.")
            # Fallback to single duration
            m, s = divmod(int(duration), 60)
            h, m = divmod(m, 60)
            out_txt.append(f"Chapter 1: {h:02d}:{m:02d}:{s:02d}")
        else:
            for idx, chap in enumerate(chapters):
                start = float(chap.get('start_time', 0))
                end = float(chap.get('end_time', 0))
                length = end - start
                m, s = divmod(int(length), 60)
                h, m = divmod(m, 60)
                if h > 0:
                    out_txt.append(f"Chapter {idx+1}: {h:02d}:{m:02d}:{s:02d}")
                else:
                    out_txt.append(f"Chapter {idx+1}: {m:02d}:{s:02d}")

        out_file = f"{os.path.splitext(file_path)[0]}_chapters.txt"
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(out_txt))
            
        print(f"Successfully extracted {max(len(chapters), 1)} chapters.")
        print(f"Saved to: {out_file}")

    except Exception as e:
        print(f"Error processing file: {e}")
        print("Ensure 'ffprobe' is installed and your file is a valid audio file.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Extract audiobook chapters to a text file.")
    parser.add_argument("file", help="Path to the audio file (e.g., .m4b, .mp3)")
    args = parser.parse_args()

    get_chapter_lengths(args.file)

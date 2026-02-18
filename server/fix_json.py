
def fix_json():
    input_path = 'src/main/resources/jlpt_vocab.json'
    output_path = 'jlpt_vocab_fixed_v2.json'
    
    try:
        with open(input_path, 'r') as f:
            lines = f.readlines()
            
        with open(output_path, 'w') as f:
            for i, line in enumerate(lines):
                stripped = line.strip()
                
                # Keep first line if it starts with {
                if i == 0:
                    f.write(line)
                    continue
                    
                # Keep last line if it ends with }
                if i == len(lines) - 1:
                    f.write(line)
                    continue

                # Remove intermediate opening braces
                if stripped == '{':
                    continue
                    
                # Remove intermediate closing braces (and ensure previous line has comma?)
                # If a chunk ended with }, we need to replace it with comma?
                # But my earlier analysis showed chunk boundaries like `... "N1",{`.
                # So replacing `,{` with `,` handles most cases.
                
                if line.rstrip().endswith(',{'):
                    new_line = line.replace(',{', ',')
                    f.write(new_line)
                    continue

                # Just in case some chunks ended with }
                if stripped == '}':
                    # If this is intermediate }, replace with ,
                    f.write(',\n')
                    continue

                f.write(line)

        print(f"Fixed JSON written to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    fix_json()

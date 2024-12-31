import os
import json


logger_dir = os.getenv('LOGCONNECTOR_HOME')
LOG_FILE_PATH = os.path.join(logger_dir, 'var', 'log', 'logconnector', 'logconnector.log')
CHECKPOINT_KEY = "logconnector_checkpoint"


def read_log_file():
    """
    Reads the log file, processes logs with 'info' or 'error' levels,
    and uses the checkpoint to resume from where it left off. Handles file rotation.
    """
    # Fetch checkpoint data (position and inode)
    checkpoint_data = checkpoint.get_checkpoint(CHECKPOINT_KEY) or {}
    last_position = checkpoint_data.get("position", 0)
    last_inode = checkpoint_data.get("inode", None)

    current_inode = os.stat(LOG_FILE_PATH).st_ino

    # If the file has been rotated (inode changed), start reading from the beginning
    if last_inode != current_inode:
        last_position = 0  # Reset the position

    with open(LOG_FILE_PATH, 'r') as log_file:
        # Move to the last read position
        log_file.seek(last_position)
        
        for line in log_file:
            try:
                log_data = json.loads(line)  # Parse each line as JSON
                
                if log_data.get("level") in loglevel:
                    if log_data.get("component") in component:
                        Event.write(data=line.strip())  
            
            except json.JSONDecodeError:
                # Handle any malformed log entries (skip in this case)
                continue
        
        # Update the checkpoint with the new file position and inode
        new_position = log_file.tell()
        checkpoint.update_checkpoint(CHECKPOINT_KEY, {
            "position": new_position,
            "inode": current_inode
        })

if __name__ == "__main__":
    read_log_file()
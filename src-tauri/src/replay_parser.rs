use serde::Serialize;
use std::fs;
use std::io::{self};
use std::path::Path;

#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    name: String,
    faction: String,
    id: u32,
    doctrine: u32,
    team: u32,
}

#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    tick: u32,
    player_name: String,
    player_id: u32,
    text: String,
    recipient: u32,
    time_stamp: String,
}

#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    tick: u32,
    player_id: u32,
    player_name: String,
    time_stamp: String,
    raw_hex: String,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedReplay {
    file_name: String,
    replay_version: u32,
    game_type: String,
    game_date: String,
    mod_name: String,
    map_file_name: String,
    map_name: String,
    map_name_formatted: String,
    replay_name: String,
    match_type: String,
    high_resources: bool,
    random_start: bool,
    vp_count: u32,
    vp_game: bool,
    duration: f64,
    players: Vec<Player>,
    messages: Vec<Message>,
    actions: Vec<Action>,
    player_count: usize,
    message_count: usize,
    action_count: usize,
}

struct BinaryReader {
    data: Vec<u8>,
    pos: usize,
}

impl BinaryReader {
    fn new(data: Vec<u8>) -> Self {
        Self { data, pos: 0 }
    }

    fn remaining(&self) -> usize {
        self.data.len().saturating_sub(self.pos)
    }

    fn seek(&mut self, pos: usize) {
        self.pos = pos;
    }

    fn skip(&mut self, count: usize) {
        self.pos += count;
    }

    fn read_u8(&mut self) -> io::Result<u8> {
        if self.pos >= self.data.len() {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                format!("EOF reading u8 at pos {}/{}", self.pos, self.data.len()),
            ));
        }
        let val = self.data[self.pos];
        self.pos += 1;
        Ok(val)
    }

    fn read_u16(&mut self) -> io::Result<u16> {
        if self.remaining() < 2 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                format!("EOF reading u16 at pos {}/{}", self.pos, self.data.len()),
            ));
        }
        let val = u16::from_le_bytes(self.data[self.pos..self.pos + 2].try_into().unwrap());
        self.pos += 2;
        Ok(val)
    }

    fn read_u32(&mut self) -> io::Result<u32> {
        if self.remaining() < 4 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                format!("EOF reading u32 at pos {}/{}", self.pos, self.data.len()),
            ));
        }
        let val = u32::from_le_bytes(self.data[self.pos..self.pos + 4].try_into().unwrap());
        self.pos += 4;
        Ok(val)
    }

    fn read_bytes(&mut self, count: usize) -> io::Result<&[u8]> {
        if self.remaining() < count {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                format!(
                    "EOF reading {} bytes at pos {}/{}",
                    count,
                    self.pos,
                    self.data.len()
                ),
            ));
        }
        let slice = &self.data[self.pos..self.pos + count];
        self.pos += count;
        Ok(slice)
    }

    fn read_ascii(&mut self, len: usize) -> io::Result<String> {
        let bytes = self.read_bytes(len)?;
        // Remove null bytes and convert to string (lossy)
        let s = String::from_utf8_lossy(bytes).replace('\0', "");
        Ok(s)
    }

    fn read_utf16(&mut self, char_count: usize) -> io::Result<String> {
        let byte_count = char_count * 2;
        let bytes = self.read_bytes(byte_count)?;
        let u16_vec: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();

        Ok(String::from_utf16_lossy(&u16_vec).replace('\0', ""))
    }
}

fn format_time(tick: u32) -> String {
    let total_ms = ((10_000_000.0 / 8.0) * tick as f64) / 10_000.0;
    let total_seconds = (total_ms / 1000.0) as u64;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
}

fn normalize_map_name(map_name: &str) -> String {
    // Simple implementation of the regex logic: /^(\d+)p_(.+)$/
    if let Some(idx) = map_name.find("p_") {
        if idx > 0 && map_name[..idx].chars().all(char::is_numeric) {
            let player_count = &map_name[..idx];
            let name_part = &map_name[idx + 2..];

            let formatted = name_part
                .replace('_', " ")
                .split_whitespace()
                .map(|word| {
                    let mut chars = word.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
                    }
                })
                .collect::<Vec<String>>()
                .join(" ");

            return format!("{} ({})", formatted, player_count);
        }
    }

    // Fallback
    map_name
        .replace('_', " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ")
}

#[tauri::command]
pub async fn parse_replay(path: String) -> Result<ParsedReplay, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let file_name = Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut reader = BinaryReader::new(data);
    let mut result = ParsedReplay {
        file_name,
        ..Default::default()
    };

    // Parse Header
    result.replay_version = reader
        .read_u32()
        .map_err(|e| format!("Header Version: {}", e))?;
    result.game_type = reader
        .read_ascii(8)
        .map_err(|e| format!("Header GameType: {}", e))?;

    // Parse Date
    let mut date_len = 0;
    let start_pos = reader.pos;
    while let Ok(val) = reader.read_u16() {
        if val == 0 {
            break;
        }
        date_len += 1;
    }
    reader.seek(start_pos);
    result.game_date = reader
        .read_utf16(date_len)
        .map_err(|e| format!("Header Date: {}", e))?;

    reader.seek(76);

    // Parse Chunky Sections
    parse_chunky(&mut reader, &mut result).map_err(|e| format!("Chunky 1: {}", e))?;
    parse_chunky(&mut reader, &mut result).map_err(|e| format!("Chunky 2: {}", e))?;

    // Assign Player IDs (reverse order logic from TS)
    for i in 0..result.players.len() {
        result.players[i].id = (1000 + (result.players.len() - 1 - i)) as u32;
    }
    result.player_count = result.players.len();

    // Parse Data
    parse_data(&mut reader, &mut result).map_err(|e| format!("Data: {}", e))?;

    result.message_count = result.messages.len();
    result.map_name_formatted = normalize_map_name(&result.map_name);

    Ok(result)
}

fn parse_chunky(reader: &mut BinaryReader, result: &mut ParsedReplay) -> io::Result<()> {
    if reader.remaining() < 12 {
        return Ok(());
    }

    let header = reader.read_ascii(12)?;
    if header != "Relic Chunky" {
        return Ok(());
    }

    reader.skip(4);
    if reader.read_u32()? != 3 {
        return Ok(());
    }

    reader.skip(4);
    let len_val = reader.read_u32()?;
    if len_val < 28 {
        return Ok(()); // Invalid chunk length
    }
    let skip_bytes = len_val - 28;
    reader.skip(skip_bytes as usize);

    while parse_chunk(reader, result)? {}
    Ok(())
}

fn parse_chunk(reader: &mut BinaryReader, result: &mut ParsedReplay) -> io::Result<bool> {
    if reader.remaining() < 8 {
        return Ok(false);
    }

    let chunk_type = reader.read_ascii(8)?;
    if !chunk_type.starts_with("FOLD") && !chunk_type.starts_with("DATA") {
        reader.pos -= 8;
        return Ok(false);
    }

    let version = reader.read_u32()?;
    let length = reader.read_u32()?;
    let name_len = reader.read_u32()?;

    reader.skip(8);

    if name_len > 0 {
        reader.read_ascii(name_len as usize)?;
    }

    let start_pos = reader.pos;

    if chunk_type.starts_with("FOLD") {
        while reader.pos < start_pos + length as usize {
            if !parse_chunk(reader, result)? {
                break;
            }
        }
    } else if chunk_type == "DATASDSC" && version == 2004 {
        // 0x7d4
        reader.skip(4);
        let skip_count = reader.read_u32()?;
        reader.skip((12 + 2 * skip_count) as usize);

        let mod_name_len = reader.read_u32()?;
        result.mod_name = reader.read_ascii(mod_name_len as usize)?;

        let map_file_len = reader.read_u32()?;
        result.map_file_name = reader.read_ascii(map_file_len as usize)?;

        reader.skip(20);

        let map_name_len = reader.read_u32()?;
        result.map_name = reader.read_utf16(map_name_len as usize)?;

        // Skip description
        let desc_len = reader.read_u32()?;
        reader.read_utf16(desc_len as usize)?;

        reader.skip(4); // width/height
        reader.skip(4);
    } else if chunk_type == "DATABASE" && version == 11 {
        // 0xb
        reader.skip(16);
        result.random_start = reader.read_u32()? == 0;
        reader.skip(4);
        result.high_resources = reader.read_u32()? == 1;
        reader.skip(4);
        let vp_val = reader.read_u32()?;
        result.vp_count = 250 * (1 << vp_val);
        reader.skip(5);

        let replay_name_len = reader.read_u32()?;
        result.replay_name = reader.read_utf16(replay_name_len as usize)?;

        reader.skip(8);
        result.vp_game = reader.read_u32()? == 0x603872a3;
        reader.skip(23);

        // Skip versions
        let s_len = reader.read_u32()?;
        reader.read_ascii(s_len as usize)?;
        reader.skip(4);
        let s_len = reader.read_u32()?;
        reader.read_ascii(s_len as usize)?;
        reader.skip(8);

        if reader.read_u32()? == 2 {
            let s_len = reader.read_u32()?;
            reader.read_ascii(s_len as usize)?;
            let s_len = reader.read_u32()?;
            reader.read_ascii(s_len as usize)?;
        }

        let s_len = reader.read_u32()?;
        reader.read_ascii(s_len as usize)?;
        let match_type_len = reader.read_u32()?;
        result.match_type = reader.read_ascii(match_type_len as usize)?;
    } else if chunk_type == "DATAINFO" && version == 6 {
        let name_len = reader.read_u32()?;
        let name = reader.read_utf16(name_len as usize)?;
        let _id = reader.read_u16()?; // Internal ID, we assign our own
        reader.skip(6);
        let faction_len = reader.read_u32()?;
        let faction = reader.read_ascii(faction_len as usize)?;

        result.players.push(Player {
            name,
            faction,
            id: 0, // Assigned later
            doctrine: 0,
            team: 0,
        });
    }

    reader.seek(start_pos + length as usize);
    Ok(true)
}

fn parse_data(reader: &mut BinaryReader, result: &mut ParsedReplay) -> io::Result<()> {
    let mut current_tick = 0;

    while reader.remaining() >= 4 {
        let marker = reader.read_u32()?;

        if marker == 1 {
            // Message
            if reader.remaining() < 4 {
                break;
            }
            let msg_block_len = reader.read_u32()?;
            let next_pos = reader.pos + msg_block_len as usize;

            if reader.remaining() < 4 {
                reader.seek(next_pos);
                continue;
            }

            if reader.read_u32()? > 0 {
                if reader.remaining() < 4 {
                    reader.seek(next_pos);
                    continue;
                }
                reader.skip(4);

                if reader.remaining() < 4 {
                    reader.seek(next_pos);
                    continue;
                }
                let name_len = reader.read_u32()?;

                let (player_name, player_id) = if name_len > 0 {
                    (
                        reader.read_utf16(name_len as usize)?,
                        reader.read_u16()? as u32,
                    )
                } else {
                    if reader.remaining() < 2 {
                        reader.seek(next_pos);
                        continue;
                    }
                    reader.skip(2);
                    ("System".to_string(), 0)
                };

                if reader.remaining() < 6 {
                    reader.seek(next_pos);
                    continue;
                }
                reader.skip(6);

                if reader.remaining() < 8 {
                    reader.seek(next_pos);
                    continue;
                }
                let recipient = reader.read_u32()?;
                let msg_len = reader.read_u32()?;
                let text = reader.read_utf16(msg_len as usize)?;

                result.messages.push(Message {
                    tick: current_tick,
                    player_name,
                    player_id,
                    text,
                    recipient,
                    time_stamp: format_time(current_tick),
                });
            }
            // CRITICAL: Ensure we skip the entire message block
            if next_pos <= reader.data.len() {
                reader.seek(next_pos);
            } else {
                break;
            }
        } else {
            // Tick
            if reader.remaining() < 4 {
                break;
            }
            let tick_len = reader.read_u32()?;
            if tick_len == 0 {
                continue;
            }

            // Check if the full tick is available
            if reader.remaining() < tick_len as usize {
                break; // Truncated tick at end of file
            }

            let tick_start = reader.pos;
            let tick_id = reader.read_u32()?;
            current_tick = tick_id;

            reader.skip(8); // Timestamp bytes
            let bundle_count = reader.read_u32()?;

            for _ in 0..bundle_count {
                if reader.pos >= tick_start + tick_len as usize {
                    break;
                }

                // Bundle header: 12 bytes
                if reader.remaining() < 12 {
                    break;
                }
                reader.skip(12);

                if reader.remaining() < 4 {
                    break;
                }
                let action_block_size = reader.read_u32()?;

                if action_block_size > 0 && action_block_size < 65536 {
                    if reader.remaining() < 1 {
                        break;
                    }
                    reader.skip(1); // Skip duplicate byte

                    let action_end_pos = reader.pos + action_block_size as usize;

                    // Ensure we don't go past the end of the file or the tick
                    if action_end_pos > reader.data.len() {
                        break;
                    }

                    parse_actions_in_block(reader, result, current_tick, action_end_pos)?;
                    reader.seek(action_end_pos);
                } else {
                    if reader.remaining() < 1 {
                        break;
                    }
                    reader.skip(1); // Skip zero byte
                }
            }

            // Ensure we align to next tick
            reader.seek(tick_start + tick_len as usize);
        }
    }

    result.duration = (current_tick as f64) / 8.0;
    Ok(())
}

fn parse_actions_in_block(
    reader: &mut BinaryReader,
    result: &mut ParsedReplay,
    tick: u32,
    end_pos: usize,
) -> io::Result<()> {
    while reader.pos + 2 <= end_pos {
        let action_len = reader.read_u16()?;
        if action_len == 0 || action_len > 1000 {
            break;
        }

        // Rewind to capture full action data including length bytes
        reader.pos -= 2;
        let action_start = reader.pos;

        if action_start + (action_len as usize) > end_pos {
            break;
        }

        // Capture data for hex string and player ID extraction
        let capture_len = std::cmp::max(action_len as usize, 30);
        let available = reader.data.len() - action_start;
        let safe_len = std::cmp::min(capture_len, available);

        let action_data = &reader.data[action_start..action_start + safe_len];

        // Extract Player ID (offset 4)
        let mut player_id = 0;
        if action_data.len() >= 6 {
            player_id = u16::from_le_bytes(action_data[4..6].try_into().unwrap()) as u32;
        }

        let player_name = result
            .players
            .iter()
            .find(|p| p.id == player_id)
            .map(|p| p.name.clone())
            .unwrap_or_default();

        // Simple hex encoding
        let raw_hex = action_data
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>();

        result.actions.push(Action {
            tick,
            player_id,
            player_name,
            time_stamp: format_time(tick),
            raw_hex,
        });

        result.action_count += 1;

        // Advance to next action
        reader.pos = action_start + action_len as usize;
    }
    Ok(())
}

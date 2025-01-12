-- Ensure settings are loaded
if not _G.Settings or not _G.Settings.webhook or _G.Settings.webhook == "" then
    warn("⚠️ Webhook URL is not set in _G.Settings. Please define it in your executor script.")
    return
end

local HttpService = game:GetService("HttpService")

-- Berry Images
local berryImages = {
    ["White Cloud Berry"] = "https://cdn.discordapp.com/attachments/1301165217194971158/1327909480750387232/White_Cloud_Berry.webp",
    ["Blue Icicle Berry"] = "https://cdn.discordapp.com/attachments/1301165217194971158/1327909470067757127/Blue_Icicle_Berry.webp",
    ["Green Toad Berry"] = "https://cdn.discordapp.com/attachments/1301165217194971158/1327909457161617458/Green_Toad_Berry.webp",
    ["Orange Berry"] = "https://cdn.discordapp.com/attachments/1301165217194971158/1327909444239228989/Orange_Berry.webp",
    ["Pink Pig Berry"] = "https://cdn.discordapp.com/attachments/1301165217194971158/1327909430162886666/Pink_Pig_Berry.webp",
    ["Purple Jelly Berry"] = "https://cdn.discordapp.com/attachments/1301165217194971158/1327909417022128171/Purple_Jelly_Berry.webp",
    ["Red Cherry Berry"] = "https://cdn.discordapp.com/attachments/1301165217194971158/1327909395920588860/Red_Cherry_Berry.webp",
    ["Yellow Star Berry"] = "https://cdn.discordapp.com/attachments/1301165217194971158/1327909382377312256/Yellow_Star_Berry.webp",
}

-- Send Discord Embed Notification
local function sendDiscordEmbed(playerName, berryName, berryColor)
    local imageUrl = berryImages[berryName] or ""
    local data = {
        ["embeds"] = {{
            ["title"] = "Berry Looted!",
            ["description"] = string.format("**Player:** %s\n**Berry Color:** ```%s```", playerName, berryColor),
            ["color"] = tonumber("0x" .. berryColor:gsub("#", ""), 16) or 0xFFFFFF,
            ["image"] = { ["url"] = imageUrl },
            ["footer"] = { ["text"] = "Happy hunting!" }
        }}
    }

    local jsonData = HttpService:JSONEncode(data)
    HttpService:PostAsync(_G.Settings.webhook, jsonData, Enum.HttpContentType.ApplicationJson)
end

-- Example Berry Loot Event
game.Workspace.BerryLootedEvent.OnClientEvent:Connect(function(berryName, berryColor)
    local player = game.Players.LocalPlayer
    sendDiscordEmbed(player.Name, berryName, berryColor)
end)

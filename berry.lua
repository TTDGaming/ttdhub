_G.Settings = {
    ["webhook"] = "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN" -- Replace with your webhook URL
}

local HttpService = game:GetService("HttpService")

-- Berry Images (Example)
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

-- Function to send a webhook with embed
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

    -- Debugging: Output the data you're sending to the webhook
    print("Sending data to Discord:", jsonData)

    -- Send the request and capture success/failure
    local success, response = pcall(function()
        return HttpService:PostAsync(_G.Settings.webhook, jsonData, Enum.HttpContentType.ApplicationJson)
    end)

    if success then
        print("Webhook sent successfully.")
    else
        warn("Error sending webhook:", response)
    end
end

-- Example Berry Loot Event (You can replace this with actual event handling in your game)
game.Workspace.BerryLootedEvent.OnClientEvent:Connect(function(berryName, berryColor)
    local player = game.Players.LocalPlayer
    sendDiscordEmbed(player.Name, berryName, berryColor)
end)

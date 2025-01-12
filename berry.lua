-- Auto Collect Berry Script with Berry ESP, GUI for Blox Fruits, and Draggable Button to Show/Hide GUI

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local LocalPlayer = Players.LocalPlayer
local Character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

-- Settings for Berry ESP
local ESP_Color = Color3.fromRGB(255, 0, 0)  -- Red color for ESP box
local ESP_Transparency = 0.5  -- Transparency of the ESP box

-- GUI Elements
local screenGui = Instance.new("ScreenGui")
screenGui.Parent = game.CoreGui
screenGui.Name = "BerryAutoCollectGUI"
screenGui.Enabled = false  -- Initially hide the GUI

local draggableButton = Instance.new("TextButton")
draggableButton.Size = UDim2.new(0, 200, 0, 50)
draggableButton.Position = UDim2.new(0, 10, 0, 10)
draggableButton.Text = "Toggle GUI"
draggableButton.Parent = screenGui

local toggleESPButton = Instance.new("TextButton")
toggleESPButton.Size = UDim2.new(0, 200, 0, 50)
toggleESPButton.Position = UDim2.new(0, 10, 0, 70)
toggleESPButton.Text = "Toggle ESP"
toggleESPButton.Parent = screenGui

local toggleAutoCollectButton = Instance.new("TextButton")
toggleAutoCollectButton.Size = UDim2.new(0, 200, 0, 50)
toggleAutoCollectButton.Position = UDim2.new(0, 10, 0, 130)
toggleAutoCollectButton.Text = "Toggle Auto Collect"
toggleAutoCollectButton.Parent = screenGui

-- Settings for enabling/disabling features
local ESPEnabled = true
local AutoCollectEnabled = true

-- Function to create ESP for berries
local function createBerryESP(berry)
    -- Create a BillboardGui to show above the berry
    local billboard = Instance.new("BillboardGui")
    billboard.Adornee = berry:FindFirstChild("HumanoidRootPart")
    billboard.Parent = berry
    billboard.Size = UDim2.new(0, 100, 0, 100)
    billboard.StudsOffset = Vector3.new(0, 3, 0)  -- Adjust height above the berry
    
    -- Create a frame inside the BillboardGui to represent the ESP box
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(1, 0, 1, 0)
    frame.BackgroundColor3 = ESP_Color
    frame.BackgroundTransparency = ESP_Transparency
    frame.BorderSizePixel = 0
    frame.Parent = billboard
end

-- Function to teleport and interact with the berry
local function tweenToBerryAndCollect(berry)
    -- Check if the berry has ProximityPrompt and a HumanoidRootPart
    local proximityPrompt = berry:FindFirstChild("ProximityPrompt")
    local humanoidRootPart = berry:FindFirstChild("HumanoidRootPart")

    if proximityPrompt and humanoidRootPart then
        -- Get the position of the berry
        local berryPosition = humanoidRootPart.Position
        local characterHRP = Character:FindFirstChild("HumanoidRootPart")
        
        -- Tween to the berry position
        local tweenInfo = TweenInfo.new(
            (berryPosition - characterHRP.Position).Magnitude / 50, -- Speed of the tween
            Enum.EasingStyle.Linear,
            Enum.EasingDirection.InOut,
            -1,
            false
        )

        local goal = { Position = berryPosition }
        local tween = TweenService:Create(characterHRP, tweenInfo, goal)
        tween:Play()

        -- Wait for the character to reach the berry (or close enough)
        repeat
            wait(0.1)
        until (berryPosition - characterHRP.Position).Magnitude < 5 -- Adjust distance as needed

        -- Stop the tween once close enough
        tween:Cancel()

        -- Simulate pressing 'E' to interact with the berry
        fireproximityprompt(proximityPrompt)
        print("Collected berry:", berry.Name)
    end
end

-- Function to find and auto collect berries
local function autoCollectBerries()
    -- Loop through all parts in the workspace to find berry objects (with ProximityPrompt)
    for _, object in pairs(workspace:GetChildren()) do
        if object:IsA("Model") and object:FindFirstChild("ProximityPrompt") then
            local proximityPrompt = object:FindFirstChild("ProximityPrompt")
            if proximityPrompt then
                -- Create an ESP for the berry (if ESP is enabled)
                if ESPEnabled then
                    createBerryESP(object)
                end

                -- If the ProximityPrompt exists and AutoCollect is enabled, call the function to tween and collect the berry
                if AutoCollectEnabled then
                    tweenToBerryAndCollect(object)
                end
                wait(1)  -- Adjust the delay between each berry collection
            end
        end
    end
end

-- Button click events to toggle features
toggleESPButton.MouseButton1Click:Connect(function()
    ESPEnabled = not ESPEnabled
    toggleESPButton.Text = ESPEnabled and "Disable ESP" or "Enable ESP"
end)

toggleAutoCollectButton.MouseButton1Click:Connect(function()
    AutoCollectEnabled = not AutoCollectEnabled
    toggleAutoCollectButton.Text = AutoCollectEnabled and "Disable Auto Collect" or "Enable Auto Collect"
end)

-- Draggable button functionality to show/hide GUI
local dragging = false
local dragInput, dragStart, startPos

local function onInputBegan(input, gameProcessedEvent)
    if gameProcessedEvent then return end
    if input.UserInputType == Enum.UserInputType.MouseButton1 and draggableButton.MouseButton1Down then
        dragging = true
        dragStart = input.Position
        startPos = draggableButton.Position
    end
end

local function onInputChanged(input)
    if dragging then
        local delta = input.Position - dragStart
        draggableButton.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + delta.X, startPos.Y.Scale, startPos.Y.Offset + delta.Y)
    end
end

local function onInputEnded(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        dragging = false
    end
end

-- Show/hide GUI when draggable button is clicked
draggableButton.MouseButton1Click:Connect(function()
    screenGui.Enabled = not screenGui.Enabled  -- Toggle the GUI visibility
end)

-- Connect input events
UserInputService.InputBegan:Connect(onInputBegan)
UserInputService.InputChanged:Connect(onInputChanged)
UserInputService.InputEnded:Connect(onInputEnded)

-- Run the auto collect function every 3 seconds (or adjust interval as needed)
while true do
    autoCollectBerries()
    wait(3)  -- Adjust the time interval (in seconds) as needed
end

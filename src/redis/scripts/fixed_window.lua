-- 固定窗口限流 Lua 脚本
-- KEYS[1] = 限流 key
-- ARGV[1] = 窗口大小(ms)
-- ARGV[2] = 限流阈值
-- ARGV[3] = 请求权重
-- 返回: {1(允许)/0(拒绝), 剩余数量, 重置时间戳}

local key = KEYS[1]
local window_size = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local weight = tonumber(ARGV[3]) or 1

-- 获取当前时间
local current_time = redis.call('TIME')
local current_ms = tonumber(current_time[1]) * 1000 + math.floor(tonumber(current_time[2]) / 1000)

-- 计算窗口开始时间
local window_start = math.floor(current_ms / window_size) * window_size

-- 生成当前窗口的 key
local window_key = key .. ":" .. window_start

-- 获取当前窗口的计数
local current_count = redis.call('GET', window_key) or 0
current_count = tonumber(current_count)

-- 检查是否超过阈值
if current_count + weight > limit then
    -- 超过阈值，拒绝请求
    local remaining = limit - current_count
    local reset_at = window_start + window_size
    return {0, remaining, reset_at}
else
    -- 在阈值内，允许请求并增加计数
    local new_count = redis.call('INCRBY', window_key, weight)
    
    -- 设置过期时间
    redis.call('PEXPIRE', window_key, window_size)
    
    local remaining = limit - new_count
    local reset_at = window_start + window_size
    return {1, remaining, reset_at}
end

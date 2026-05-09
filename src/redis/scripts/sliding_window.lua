-- 滑动窗口限流 Lua 脚本
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

-- 移除窗口外的请求记录
local window_start = current_ms - window_size
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- 计算当前窗口内的请求数
local current_count = redis.call('ZCARD', key)

-- 检查是否超过阈值
if current_count + weight > limit then
    -- 超过阈值，拒绝请求
    local remaining = limit - current_count
    
    -- 获取最早的请求时间，计算重置时间
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local reset_at = current_ms + window_size
    if #oldest > 0 then
        reset_at = tonumber(oldest[2]) + window_size
    end
    
    return {0, remaining, reset_at}
else
    -- 在阈值内，添加当前请求记录
    for i = 1, weight do
        redis.call('ZADD', key, current_ms, current_ms .. '-' .. i)
    end
    
    -- 设置过期时间
    redis.call('PEXPIRE', key, window_size)
    
    local new_count = redis.call('ZCARD', key)
    local remaining = limit - new_count
    local reset_at = current_ms + window_size
    
    return {1, remaining, reset_at}
end

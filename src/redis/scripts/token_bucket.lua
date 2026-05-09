-- 令牌桶限流 Lua 脚本
-- KEYS[1] = 令牌桶 key
-- ARGV[1] = 桶容量
-- ARGV[2] = 填充速率(令牌/ms)
-- ARGV[3] = 请求权重(消耗令牌数)
-- 返回: {1(允许)/0(拒绝), 剩余令牌数, 下一次可获取时间戳}

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local fill_rate = tonumber(ARGV[2])
local weight = tonumber(ARGV[3]) or 1

-- 获取当前时间
local current_time = redis.call('TIME')
local current_ms = tonumber(current_time[1]) * 1000 + math.floor(tonumber(current_time[2]) / 1000)

-- 获取桶的当前状态
local bucket_info = redis.call('HMGET', key, 'tokens', 'last_fill')
local tokens = tonumber(bucket_info[1]) or capacity
local last_fill = tonumber(bucket_info[2]) or current_ms

-- 计算应该补充的令牌数
local elapsed = current_ms - last_fill
if elapsed > 0 then
    local new_tokens = math.floor(elapsed * fill_rate)
    tokens = math.min(tokens + new_tokens, capacity)
    last_fill = current_ms
end

-- 检查是否有足够的令牌
if tokens < weight then
    -- 令牌不足，拒绝请求
    local tokens_needed = weight - tokens
    local wait_time = math.ceil(tokens_needed / fill_rate)
    local next_available = current_ms + wait_time
    
    return {0, tokens, next_available}
else
    -- 令牌充足，消耗令牌并允许请求
    tokens = tokens - weight
    
    -- 更新桶的状态
    redis.call('HMSET', key, 'tokens', tokens, 'last_fill', last_fill)
    
    -- 设置过期时间(60秒，足够覆盖最大等待时间)
    redis.call('PEXPIRE', key, 60000)
    
    return {1, tokens, current_ms}
end

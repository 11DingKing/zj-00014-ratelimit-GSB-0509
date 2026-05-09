-- 漏桶限流 Lua 脚本
-- KEYS[1] = 漏桶 key
-- ARGV[1] = 桶容量(突发请求数)
-- ARGV[2] = 漏出速率(请求/ms)
-- ARGV[3] = 请求权重(占用桶容量)
-- 返回: {1(允许)/0(拒绝), 剩余容量, 下一次可获取时间戳}

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leak_rate = tonumber(ARGV[2])
local weight = tonumber(ARGV[3]) or 1

-- 获取当前时间
local current_time = redis.call('TIME')
local current_ms = tonumber(current_time[1]) * 1000 + math.floor(tonumber(current_time[2]) / 1000)

-- 获取桶的当前状态
local bucket_info = redis.call('HMGET', key, 'water_level', 'last_leak')
local water_level = tonumber(bucket_info[1]) or 0
local last_leak = tonumber(bucket_info[2]) or current_ms

-- 计算漏出的水量
local elapsed = current_ms - last_leak
if elapsed > 0 then
    local leaked = math.floor(elapsed * leak_rate)
    water_level = math.max(0, water_level - leaked)
    last_leak = current_ms
end

-- 检查是否有足够的容量
if water_level + weight > capacity then
    -- 容量不足，拒绝请求
    local needed = water_level + weight - capacity
    local wait_time = math.ceil(needed / leak_rate)
    local next_available = current_ms + wait_time
    
    return {0, capacity - water_level, next_available}
else
    -- 容量充足，接受请求
    water_level = water_level + weight
    
    -- 更新桶的状态
    redis.call('HMSET', key, 'water_level', water_level, 'last_leak', last_leak)
    
    -- 设置过期时间(60秒，足够覆盖最大等待时间)
    redis.call('PEXPIRE', key, 60000)
    
    return {1, capacity - water_level, current_ms}
end

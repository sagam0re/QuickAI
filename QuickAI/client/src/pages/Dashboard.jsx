import React, { useEffect, useState } from 'react'
import {dummyCreationData} from '../assets/assets'
import { Gem, Sparkles } from 'lucide-react'
import {Protect} from '@clerk/clerk-react'
import CreationItem from '../components/CreationItem'

function Dashboard() {

    const [creations, setCreations] = useState([])

    const getDashboardData = async () => {
        setCreations(dummyCreationData)
    }

    useEffect(() => {
        getDashboardData()
    }, [])

    return (
        <div className='p-6 h-full overflow-y-scroll'>
            <div className='flex flex-wrap gap-4 justify-start'>
                {/*{"Total Creations Card"}*/}
                <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200'>
                    <div className='text-slate-600'>
                        <p className='text-sm'>Total Creations</p>
                        <h2 className='text-xl font-semibold'>{creations.length}</h2>
                    </div>
                    <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#3588F2] to-[#0BB0D7] text-white flex justify-center items-center'>
                        <Sparkles className='w-5 text-white' />
                    </div>
                </div> 
                {/*{"Active Plan Card"}*/}
                <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200'>
                    <div className='text-slate-600'>
                        <p className='text-sm'>Active Plan</p>
                        <h2 className='text-xl font-semibold'>
                            <Protect plan='premium' fallback='Free'>Premium</Protect>
                        </h2>
                    </div>
                    <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF61C6] to-[#9E53EE] text-white flex justify-center items-center'>
                        <Gem className='w-5 text-white' />
                    </div>
                </div>
            </div>
            <div className='space-y-3'>
                <p className='mt-6 mb-4'>Recent Creations</p>
                {
                    creations.map((item) => {
                        return <CreationItem key={item.id} item={item} />
                    })
                }
            </div>
        </div>
    )
}

export default Dashboard
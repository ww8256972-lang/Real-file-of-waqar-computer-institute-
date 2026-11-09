package com.waqarinstitute.erp.data.paging

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.waqarinstitute.erp.data.local.StudentEntity
import kotlinx.coroutines.delay
import timber.log.Timber

/**
 * Paging 3 Source for 100,000 Student Chunk Loading
 * Uses Kotlin Coroutines & Flow to load in chunks of 50 without UI stutter.
 */
class StudentPagingSource(
    private val fetchPage: suspend (page: Int, pageSize: Int) -> List<StudentEntity>
) : PagingSource<Int, StudentEntity>() {

    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, StudentEntity> {
        val currentPage = params.key ?: 1
        return try {
            val pageSize = params.loadSize
            Timber.d("Loading student page: $currentPage with size: $pageSize")
            val students = fetchPage(currentPage, pageSize)

            LoadResult.Page(
                data = students,
                prevKey = if (currentPage == 1) null else currentPage - 1,
                nextKey = if (students.isEmpty()) null else currentPage + 1
            )
        } catch (e: Exception) {
            Timber.e(e, "Error loading student page $currentPage")
            LoadResult.Error(e)
        }
    }

    override fun getRefreshKey(state: PagingState<Int, StudentEntity>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}

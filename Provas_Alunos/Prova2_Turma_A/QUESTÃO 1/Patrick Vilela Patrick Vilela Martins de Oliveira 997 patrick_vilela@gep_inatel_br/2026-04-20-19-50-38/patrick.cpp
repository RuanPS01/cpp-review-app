#include <iostream>
#include <iomanip>
#include <cmath>

using namespace std;

int main()
{
    int N;
    int A;
    int R;
    int i = 0;
    cin >> N;
    cin >> A;
    cin >> R;
    while(i < N)
    {
        cout << A << " ";
        A = A + R;
        i++;
    }
    return 0;
}
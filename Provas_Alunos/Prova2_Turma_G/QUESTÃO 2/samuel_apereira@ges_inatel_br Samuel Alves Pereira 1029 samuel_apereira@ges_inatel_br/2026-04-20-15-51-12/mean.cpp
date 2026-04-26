#include <iostream>
#include <iomanip>
using namespace std;


int main()
{
    int n;
    cin >> n;
    
    int sum = 0;
    
    for (int i = 0; i < n; i++)
    {
        int a;
        cin >> a;
        
        sum += a;
    }
    
    float even = sum / (n * 1.0);
    cout << fixed << setprecision(4);
    cout << even;
    
    return 0;
}